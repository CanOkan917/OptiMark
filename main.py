import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def resize_if_needed(image: np.ndarray, max_width: int = 1400) -> np.ndarray:
    height, width = image.shape[:2]
    if width <= max_width:
        return image

    scale = max_width / float(width)
    new_size = (max_width, int(height * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def preprocess_image(image: np.ndarray) -> dict[str, np.ndarray]:
    steps: dict[str, np.ndarray] = {}

    resized = resize_if_needed(image)
    steps["01_resized"] = resized

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    steps["02_gray"] = gray

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    steps["03_blur"] = blur

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = clahe.apply(blur)
    steps["04_contrast"] = contrast

    _, otsu = cv2.threshold(
        contrast, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    steps["05_threshold_otsu"] = otsu

    adaptive = cv2.adaptiveThreshold(
        contrast,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        10,
    )
    steps["06_threshold_adaptive"] = adaptive

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    opened = cv2.morphologyEx(otsu, cv2.MORPH_OPEN, kernel, iterations=1)
    steps["07_opened"] = opened

    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)
    steps["08_closed"] = closed

    edges = cv2.Canny(closed, 70, 180)
    steps["09_edges"] = edges

    return steps


def save_steps(steps: dict[str, np.ndarray], output_dir: Path) -> None:
    ensure_dir(output_dir)
    final_name = "08_closed"
    final_image = steps[final_name]
    cv2.imwrite(str(output_dir / f"{final_name}.png"), final_image)


def _candidate_score(area: float, fill_ratio: float, aspect: float) -> float:
    aspect_penalty = abs(1.0 - aspect)
    return area * fill_ratio * max(0.0, 1.0 - aspect_penalty)


def _detect_best_marker_in_region(
    binary_image: np.ndarray,
    corner_name: str,
    target_corner: tuple[int, int],
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    image_area: float,
) -> dict | None:
    roi = binary_image[y0:y1, x0:x1]
    if roi.size == 0:
        return None
    image_h, image_w = binary_image.shape[:2]
    diag = (image_w**2 + image_h**2) ** 0.5

    contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_score = -1.0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.00008:
            continue
        if area > image_area * 0.0022:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        if bw == 0 or bh == 0:
            continue
        if bw > roi.shape[1] * 0.45 or bh > roi.shape[0] * 0.45:
            continue

        aspect = bw / float(bh)
        if not (0.65 <= aspect <= 1.35):
            continue

        box_area = float(bw * bh)
        fill_ratio = area / box_area
        if fill_ratio < 0.45:
            continue

        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            continue

        cx = x0 + (moments["m10"] / moments["m00"])
        cy = y0 + (moments["m01"] / moments["m00"])

        tx, ty = target_corner
        corner_dist = ((cx - tx) ** 2 + (cy - ty) ** 2) ** 0.5
        dist_norm = corner_dist / diag
        if dist_norm > 0.22:
            continue
        proximity = max(0.0, 1.0 - dist_norm * 2.4)
        score = _candidate_score(area, fill_ratio, aspect) * proximity
        if score <= best_score:
            continue

        best_score = score
        best = {
            "x": float(cx),
            "y": float(cy),
            "bbox": {
                "x": int(x0 + x),
                "y": int(y0 + y),
                "w": int(bw),
                "h": int(bh),
            },
            "confidence": float(score),
        }

    return best


def detect_corner_markers(binary_image: np.ndarray) -> dict[str, dict]:
    h, w = binary_image.shape[:2]
    image_area = float(h * w)
    corner_targets = {
        "top_left": (0, 0),
        "top_right": (w, 0),
        "bottom_left": (0, h),
        "bottom_right": (w, h),
    }

    detected: dict[str, dict] = {}
    for corner_name, target_corner in corner_targets.items():
        marker = None

        # First try a tight corner window; if not found, relax once.
        for region_ratio in (0.16, 0.26):
            region_w = int(w * region_ratio)
            region_h = int(h * region_ratio)

            if corner_name == "top_left":
                x0, y0, x1, y1 = 0, 0, region_w, region_h
            elif corner_name == "top_right":
                x0, y0, x1, y1 = w - region_w, 0, w, region_h
            elif corner_name == "bottom_left":
                x0, y0, x1, y1 = 0, h - region_h, region_w, h
            else:
                x0, y0, x1, y1 = w - region_w, h - region_h, w, h

            marker = _detect_best_marker_in_region(
                binary_image=binary_image,
                corner_name=corner_name,
                target_corner=target_corner,
                x0=x0,
                y0=y0,
                x1=x1,
                y1=y1,
                image_area=image_area,
            )
            if marker is not None:
                break

        if marker is not None:
            detected[corner_name] = marker

    return detected


def save_marker_outputs(
    color_image: np.ndarray,
    markers: dict[str, dict],
    output_dir: Path,
) -> None:
    overlay = color_image.copy()
    for corner_name, marker in markers.items():
        x = int(round(marker["x"]))
        y = int(round(marker["y"]))
        cv2.circle(overlay, (x, y), 12, (0, 0, 255), 2)
        cv2.putText(
            overlay,
            corner_name,
            (x + 8, y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 255),
            1,
            cv2.LINE_AA,
        )

    cv2.imwrite(str(output_dir / "markers_overlay.png"), overlay)

    marker_json = {
        "image_size": {
            "width": int(color_image.shape[1]),
            "height": int(color_image.shape[0]),
        },
        "detected_count": len(markers),
        "markers": markers,
    }
    (output_dir / "markers.json").write_text(
        json.dumps(marker_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OptiMark preprocessing starter pipeline"
    )
    parser.add_argument(
        "--image",
        required=True,
        help="Input image path to preprocess",
    )
    parser.add_argument(
        "--output-dir",
        default="output/preprocess",
        help="Directory to save preprocessing outputs",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        raise FileNotFoundError(f"Input image not found: {image_path}")

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    steps = preprocess_image(image)
    output_dir = Path(args.output_dir)
    save_steps(steps, output_dir)
    markers = detect_corner_markers(steps["08_closed"])
    save_marker_outputs(steps["01_resized"], markers, output_dir)

    print(f"Preprocessing completed for: {image_path}")
    print(f"Saved final preprocessing output to: {output_dir / '08_closed.png'}")
    print(f"Detected markers: {len(markers)}/4")
    print(f"Saved marker outputs to: {output_dir / 'markers_overlay.png'} and {output_dir / 'markers.json'}")


if __name__ == "__main__":
    main()

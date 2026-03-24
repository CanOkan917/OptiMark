import cv2
import numpy as np


def _candidate_score(area: float, fill_ratio: float, aspect: float) -> float:
    aspect_penalty = abs(1.0 - aspect)
    return area * fill_ratio * max(0.0, 1.0 - aspect_penalty)


def _detect_best_marker_in_region(
        binary_image: np.ndarray,
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


def detect(binary_image: np.ndarray) -> dict[str, dict]:
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
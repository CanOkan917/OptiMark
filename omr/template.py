import json
import copy
from pathlib import Path

import cv2
import numpy as np

from omr.helpers import order_points


def resolve_template_path(explicit_path: str | None, output_dir: Path) -> Path | None:
    if explicit_path:
        path = Path(explicit_path)
        return path if path.exists() else None

    output_root = output_dir.parent if output_dir.name else output_dir
    if not output_root.exists():
        return None

    candidates = sorted(output_root.glob("optimark_sheet_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        return None
    return candidates[0]


def load_template(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_template_to_image_coords(template: dict) -> dict:
    """
    Convert template coordinates from PDF-like bottom-left origin to
    image-like top-left origin used by OpenCV.
    """
    normalized = copy.deepcopy(template)
    page = normalized.get("page", {})
    height = page.get("height")
    if height is None:
        return normalized

    h = float(height)

    anchors = normalized.get("anchors", {})
    for key, value in anchors.items():
        if isinstance(value, list) and len(value) == 2:
            anchors[key] = [float(value[0]), h - float(value[1])]

    for question in normalized.get("questions", []):
        row_origin = question.get("row_origin")
        if isinstance(row_origin, dict) and "y" in row_origin:
            row_origin["y"] = h - float(row_origin["y"])

        for choice in question.get("choices", []):
            if "y" in choice:
                choice["y"] = h - float(choice["y"])

    student_id = normalized.get("student_id", {})
    box = student_id.get("box")
    if isinstance(box, dict):
        top = box.get("top")
        bottom = box.get("bottom")
        if top is not None and bottom is not None:
            box["top"] = h - float(bottom)
            box["bottom"] = h - float(top)

    for column in student_id.get("columns", []):
        write_box = column.get("write_box")
        if isinstance(write_box, dict) and "y_top" in write_box:
            write_box["y_top"] = h - float(write_box["y_top"])

        for bubble in column.get("bubbles", []):
            if "y" in bubble:
                bubble["y"] = h - float(bubble["y"])

    return normalized


def marker_points_from_detection(markers: dict[str, dict]) -> np.ndarray | None:
    needed = ("top_left", "top_right", "bottom_right", "bottom_left")
    if not all(k in markers for k in needed):
        return None

    points = []
    for key in needed:
        marker = markers[key]
        bbox = marker.get("bbox", {})
        if {"x", "y", "w", "h"} <= set(bbox.keys()):
            # Template anchors are bottom-left coordinates of marker blocks.
            points.append([float(bbox["x"]), float(bbox["y"] + bbox["h"])])
        else:
            points.append([float(marker["x"]), float(marker["y"])])
    return order_points(np.array(points, dtype=np.float32))


def marker_points_from_template(template: dict) -> np.ndarray | None:
    anchors = template.get("anchors", {})
    needed = ("top_left", "top_right", "bottom_right", "bottom_left")
    if not all(k in anchors for k in needed):
        return None

    points = np.array([anchors[key] for key in needed], dtype=np.float32)
    return order_points(points)


def page_corners_from_template(template: dict) -> np.ndarray | None:
    page = template.get("page", {})
    width = page.get("width")
    height = page.get("height")
    if width is None or height is None:
        return None

    return np.array(
        [
            [0.0, 0.0],
            [float(width), 0.0],
            [float(width), float(height)],
            [0.0, float(height)],
        ],
        dtype=np.float32,
    )


def project_a4_plane_on_image(
        image: np.ndarray,
    markers: dict[str, dict],
    template: dict,
) -> np.ndarray | None:
    src_markers = marker_points_from_detection(markers)
    dst_markers = marker_points_from_template(template)
    page_corners = page_corners_from_template(template)

    if src_markers is None or dst_markers is None or page_corners is None:
        return None

    # H maps detected marker space -> template marker space.
    H, _ = cv2.findHomography(src_markers, dst_markers, method=0)
    if H is None:
        return None

    H_inv = np.linalg.inv(H)
    projected = cv2.perspectiveTransform(page_corners.reshape(-1, 1, 2), H_inv).reshape(-1, 2)

    overlay = image.copy()
    cv2.polylines(
        overlay,
        [projected.astype(np.int32)],
        isClosed=True,
        color=(255, 0, 0),
        thickness=3,
    )
    return overlay

def extract_aligned_plane(
        image: np.ndarray,
        markers: dict[str, dict],
        template: dict,
) -> tuple[np.ndarray, np.ndarray] | None:
    src_markers = marker_points_from_detection(markers)
    dst_markers = marker_points_from_template(template)
    page_corners = page_corners_from_template(template)

    if src_markers is None or dst_markers is None or page_corners is None:
        return None

    H_markers, _ = cv2.findHomography(src_markers, dst_markers, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if H_markers is None:
        return None

    H_inv = np.linalg.inv(H_markers)
    src_page_corners = cv2.perspectiveTransform(
        page_corners.reshape(-1, 1, 2).astype(np.float32),
        H_inv.astype(np.float64),
    ).reshape(-1, 2).astype(np.float32)

    M = cv2.getPerspectiveTransform(src_page_corners, page_corners.astype(np.float32))

    page = template["page"]
    width = int(round(page["width"]))
    height = int(round(page["height"]))

    aligned = cv2.warpPerspective(image, M, (width, height))
    return aligned, M


def _transform_xy(x: float, y: float, matrix: np.ndarray) -> tuple[float, float]:
    pt = np.array([[[float(x), float(y)]]], dtype=np.float32)
    if matrix.shape == (3, 3):
        out = cv2.perspectiveTransform(pt, matrix)[0, 0]
    else:
        out = cv2.transform(pt, matrix)[0, 0]
    return float(out[0]), float(out[1])


def align_template_to_markers(template: dict, markers: dict[str, dict]) -> dict:
    """
    Align template coordinates directly to detected marker box.
    Uses TL marker as origin and TR/BL directions as affine basis.
    """
    src_markers = marker_points_from_template(template)
    dst_markers = marker_points_from_detection(markers)

    if src_markers is None or dst_markers is None:
        return copy.deepcopy(template)

    matrix, _ = cv2.findHomography(src_markers, dst_markers, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if matrix is None:
        # Fallback to affine if homography fails.
        src_aff = np.array([src_markers[0], src_markers[1], src_markers[3]], dtype=np.float32)
        dst_aff = np.array([dst_markers[0], dst_markers[1], dst_markers[3]], dtype=np.float32)
        matrix = cv2.getAffineTransform(src_aff, dst_aff)

    aligned = copy.deepcopy(template)

    anchors = aligned.get("anchors", {})
    for key, value in anchors.items():
        if isinstance(value, list) and len(value) == 2:
            nx, ny = _transform_xy(value[0], value[1], matrix)
            anchors[key] = [nx, ny]

    for question in aligned.get("questions", []):
        row_origin = question.get("row_origin")
        if isinstance(row_origin, dict) and "x" in row_origin and "y" in row_origin:
            nx, ny = _transform_xy(row_origin["x"], row_origin["y"], matrix)
            row_origin["x"] = nx
            row_origin["y"] = ny

        for choice in question.get("choices", []):
            if "x" in choice and "y" in choice:
                nx, ny = _transform_xy(choice["x"], choice["y"], matrix)
                choice["x"] = nx
                choice["y"] = ny

    student_id = aligned.get("student_id", {})
    box = student_id.get("box")
    if isinstance(box, dict) and {"left", "right", "top", "bottom"} <= set(box.keys()):
        corners = [
            _transform_xy(box["left"], box["top"], matrix),
            _transform_xy(box["right"], box["top"], matrix),
            _transform_xy(box["right"], box["bottom"], matrix),
            _transform_xy(box["left"], box["bottom"], matrix),
        ]
        xs = [c[0] for c in corners]
        ys = [c[1] for c in corners]
        box["left"], box["right"] = min(xs), max(xs)
        box["top"], box["bottom"] = min(ys), max(ys)

    for column in student_id.get("columns", []):
        if "x_left" in column:
            x_left, _ = _transform_xy(column["x_left"], 0.0, matrix)
            column["x_left"] = x_left
        if "x_center" in column:
            x_center, _ = _transform_xy(column["x_center"], 0.0, matrix)
            column["x_center"] = x_center

        write_box = column.get("write_box")
        if isinstance(write_box, dict) and "x" in write_box and "y_top" in write_box:
            nx, ny = _transform_xy(write_box["x"], write_box["y_top"], matrix)
            write_box["x"] = nx
            write_box["y_top"] = ny

        for bubble in column.get("bubbles", []):
            if "x" in bubble and "y" in bubble:
                nx, ny = _transform_xy(bubble["x"], bubble["y"], matrix)
                bubble["x"] = nx
                bubble["y"] = ny

    aligned["alignment"] = {
        "method": "marker_box_homography" if matrix.shape == (3, 3) else "marker_box_affine_fallback",
        "matrix": matrix.tolist(),
    }
    return aligned

import json
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


def marker_points_from_detection(markers: dict[str, dict]) -> np.ndarray | None:
    needed = ("top_left", "top_right", "bottom_right", "bottom_left")
    if not all(k in markers for k in needed):
        return None

    points = []
    for key in needed:
        marker = markers[key]
        bbox = marker.get("bbox", {})
        points.append([
            marker["x"] - (bbox.get("w", 0) / 2.0),
            marker["y"] - (bbox.get("h", 0) / 2.0),
        ])
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


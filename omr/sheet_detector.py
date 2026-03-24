import cv2
import numpy as np

from omr.helpers import order_points


def find_sheet_corners(color_image: np.ndarray) -> np.ndarray | None:
    gray = cv2.cvtColor(color_image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), dtype=np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = float(color_image.shape[0] * color_image.shape[1])
    best_quad = None
    best_contour = None
    best_area = 0.0

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:20]:
        area = cv2.contourArea(contour)
        if area < image_area * 0.15:
            continue

        if area > best_area:
            best_area = area
            best_contour = contour

        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) != 4:
            continue

        if area >= best_area:
            best_quad = approx.reshape(4, 2)

    if best_quad is not None:
        return order_points(best_quad)

    if best_contour is None:
        return None

    rect = cv2.minAreaRect(best_contour)
    box = cv2.boxPoints(rect)
    return order_points(box)


def warp_from_corners(color_image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    (tl, tr, br, bl) = corners

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = int(max(width_a, width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = int(max(height_a, height_b))

    max_width = max(100, max_width)
    max_height = max(100, max_height)

    dst = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(color_image, transform, (max_width, max_height))
    return warped


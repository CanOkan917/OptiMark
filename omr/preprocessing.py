import cv2
import numpy as np


class ImagePreprocessor:
    def __init__(self, max_width: int = 1400):
        self.max_width = max_width

    def resize_if_needed(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        if width <= self.max_width:
            return image

        scale = self.max_width / float(width)
        new_size = (self.max_width, int(height * scale))
        return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)

    def run(self, image: np.ndarray) -> dict[str, np.ndarray]:
        steps: dict[str, np.ndarray] = {}

        resized = self.resize_if_needed(image)
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

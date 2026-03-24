import json
from pathlib import Path

import cv2
import numpy as np

from omr.helpers import ensure_dir


class OutputWriter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        ensure_dir(output_dir)

    def save_final_binary(self, binary_image: np.ndarray) -> Path:
        path = self.output_dir / "08_closed.png"
        cv2.imwrite(str(path), binary_image)
        return path

    def save_marker_outputs(self, color_image: np.ndarray, markers: dict[str, dict]) -> tuple[Path, Path]:
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

        overlay_path = self.output_dir / "markers_overlay.png"
        cv2.imwrite(str(overlay_path), overlay)

        marker_json = {
            "image_size": {
                "width": int(color_image.shape[1]),
                "height": int(color_image.shape[0]),
            },
            "detected_count": len(markers),
            "markers": markers,
        }
        json_path = self.output_dir / "markers.json"
        json_path.write_text(json.dumps(marker_json, ensure_ascii=False, indent=2), encoding="utf-8")
        return overlay_path, json_path

    def save_image(self, image: np.ndarray, filename: str) -> Path:
        path = self.output_dir / filename
        cv2.imwrite(str(path), image)
        return path

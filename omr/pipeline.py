from dataclasses import dataclass
from pathlib import Path

import cv2

from omr.marker_detector import detect
from omr.output_writer import OutputWriter
from omr.preprocessing import ImagePreprocessor
from omr.sheet_detector import find_sheet_corners, warp_from_corners
from omr.template import resolve_template_path, load_template, project_a4_plane_on_image


@dataclass
class PipelineResult:
    processing_mode: str
    detected_markers: int
    final_binary_path: Path
    marker_overlay_path: Path
    marker_json_path: Path
    warped_color_path: Path | None = None
    sheet_contour_path: Path | None = None
    a4_plane_path: Path | None = None
    template_path: Path | None = None


class OMRPipeline:
    def __init__(self):
        self.preprocessor = ImagePreprocessor()

    def run(self, image_path: Path, output_dir: Path, template_json: str | None = None) -> PipelineResult:
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Could not read image: {image_path}")

        writer = OutputWriter(output_dir)
        initial_steps = self.preprocessor.run(image)
        resized = initial_steps["01_resized"]

        processing_mode = "original"
        marker_steps = initial_steps
        marker_color_image = resized
        sheet_contour_path = None
        warped_color_path = None

        corners = find_sheet_corners(resized)
        if corners is not None:
            warped = warp_from_corners(resized, corners)
            marker_steps = self.preprocessor.run(warped)
            marker_color_image = marker_steps["01_resized"]
            processing_mode = "warped"

            contour_overlay = resized.copy()
            cv2.polylines(
                contour_overlay,
                [corners.astype("int32")],
                isClosed=True,
                color=(0, 255, 0),
                thickness=3,
            )
            sheet_contour_path = writer.save_image(contour_overlay, "sheet_contour.png")
            warped_color_path = writer.save_image(marker_color_image, "warped_color.png")

        final_binary_path = writer.save_final_binary(marker_steps["08_closed"])
        markers = detect(marker_steps["08_closed"])
        marker_overlay_path, marker_json_path = writer.save_marker_outputs(marker_color_image, markers)

        template_path = resolve_template_path(template_json, output_dir)
        a4_plane_path = None
        if template_path is not None and len(markers) == 4:
            template = load_template(template_path)
            plane_overlay = project_a4_plane_on_image(
                image=marker_color_image,
                markers=markers,
                template=template,
            )
            if plane_overlay is not None:
                a4_plane_path = writer.save_image(plane_overlay, "a4_plane_overlay.png")

        return PipelineResult(
            processing_mode=processing_mode,
            detected_markers=len(markers),
            final_binary_path=final_binary_path,
            marker_overlay_path=marker_overlay_path,
            marker_json_path=marker_json_path,
            warped_color_path=warped_color_path,
            sheet_contour_path=sheet_contour_path,
            a4_plane_path=a4_plane_path,
            template_path=template_path,
        )

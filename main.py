import argparse
from pathlib import Path

from omr.pipeline import OMRPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OptiMark OMR preprocessing + marker pipeline")
    parser.add_argument("--image", required=True, help="Input image path")
    parser.add_argument("--output-dir", default="output/preprocess", help="Output directory")
    parser.add_argument(
        "--template-json",
        default=None,
        help="Template json path for A4 plane projection (optional)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image_path = Path(args.image)
    if not image_path.exists():
        raise FileNotFoundError(f"Input image not found: {image_path}")

    output_dir = Path(args.output_dir)
    pipeline = OMRPipeline()
    result = pipeline.run(
        image_path=image_path,
        output_dir=output_dir,
        template_json=args.template_json,
    )

    print(f"Image processed: {image_path}")
    print(f"Processing mode: {result.processing_mode}")
    print(f"Detected markers: {result.detected_markers}/4")
    print(f"Final binary: {result.final_binary_path}")
    print(f"Markers overlay: {result.marker_overlay_path}")
    print(f"Markers json: {result.marker_json_path}")
    if result.sheet_contour_path:
        print(f"Sheet contour: {result.sheet_contour_path}")
    if result.warped_color_path:
        print(f"Warped color: {result.warped_color_path}")
    if result.template_path:
        print(f"Template used: {result.template_path}")
    if result.a4_plane_path:
        print(f"A4 plane overlay: {result.a4_plane_path}")


if __name__ == "__main__":
    main()

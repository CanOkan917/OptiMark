from datetime import datetime
from pathlib import Path
from typing import List, Sequence, Tuple

from reportlab.pdfbase import pdfmetrics


def get_string_center(
    text: str,
    font_name: str,
    font_size: float,
    origin_x: float = 0.0,
    baseline_y: float = 0.0,
) -> Tuple[float, float]:
    """Compute the visual center of text for a ReportLab font and size."""
    width = pdfmetrics.stringWidth(text, font_name, font_size)
    cx = origin_x + width / 2.0

    ascent = pdfmetrics.getAscent(font_name, font_size)
    descent = pdfmetrics.getDescent(font_name, font_size)
    cy = baseline_y + (ascent + descent) / 2.0

    return cx, cy


def get_strings_centers(
    texts: Sequence[str],
    font_name: str,
    font_size: float,
    origins_x: Sequence[float],
    baseline_y: float = 0.0,
) -> List[Tuple[float, float]]:
    """Compute text centers for multiple strings."""
    if len(texts) != len(origins_x):
        raise ValueError("texts and origins_x must have the same length")
    return [
        get_string_center(text, font_name, font_size, origin_x, baseline_y)
        for text, origin_x in zip(texts, origins_x)
    ]


def build_output_path(output_dir: str, prefix: str = "optimark_sheet") -> str:
    """Create output directory if needed and return a timestamped PDF path."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    return str(output_path / f"{prefix}_{timestamp}.pdf")

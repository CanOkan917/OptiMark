from dataclasses import dataclass, field
from typing import Tuple, List

from reportlab.lib.pagesizes import A4


@dataclass
class SheetConfig:
    title: str = "OptiMark Answer Sheet"
    output_path: str = "optimark_answer_sheet.pdf"
    page_size: Tuple[float, float] = A4

    num_questions: int = 20
    choices: List[str] = field(default_factory=lambda: ["A", "B", "C", "D"])

    margin_x: int = 25
    margin_y: int = 25

    header_height: int = 90
    footer_height: int = 40
    max_student_ID_len: int = 8

    bubble_radius: int = 10

    # Relative spacings
    choice_spacing: int = 10
    row_spacing: int = 7
    column_spacing: int = 20

    marker_size: int = 18

    question_label_width: int = 24
    question_to_bubble_gap: int = 0

    export_template_json: bool = True
    template_output_path: str | None = None

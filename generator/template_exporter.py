import json
from datetime import datetime
from pathlib import Path

from generator.config import SheetConfig
from generator.layout import LayoutEngine


class TemplateExporter:
    def __init__(self, config: SheetConfig, layout: LayoutEngine):
        self.config = config
        self.layout = layout

    def _resolve_output_path(self) -> Path:
        if self.config.template_output_path:
            return Path(self.config.template_output_path)
        return Path(self.config.output_path).with_suffix(".json")

    def _build_student_id(self, page_width: float, page_height: float) -> dict:
        box = self.layout.get_student_id_box(page_width, page_height)
        if box is None:
            return {
                "enabled": False,
                "max_len": 0,
                "columns": [],
            }

        digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
        columns = []

        for col in range(self.config.max_student_ID_len):
            col_left = box["left"] + col * box["col_width"]
            center_x = col_left + box["col_width"] / 2
            bubbles = []

            for row_idx, digit in enumerate(digits):
                bubble_y = box["first_bubble_y"] - row_idx * box["bubble_step"]
                bubbles.append({
                    "digit": digit,
                    "x": center_x,
                    "y": bubble_y,
                    "radius": self.config.bubble_radius,
                })

            columns.append({
                "index": col,
                "x_left": col_left,
                "x_center": center_x,
                "write_box": {
                    "x": col_left,
                    "y_top": box["top"],
                    "height": box["write_box_height"],
                    "width": box["col_width"],
                },
                "bubbles": bubbles,
            })

        return {
            "enabled": True,
            "max_len": self.config.max_student_ID_len,
            "box": {
                "left": box["left"],
                "right": box["right"],
                "top": box["top"],
                "bottom": box["bottom"],
            },
            "columns": columns,
        }

    def _build_questions(self, page_width: float, page_height: float) -> list[dict]:
        positions = self.layout.get_question_positions(page_width, page_height)
        choice_step = self.layout.get_choice_center_step()

        questions = []
        for pos in positions:
            row_x = pos["x"]
            row_y = pos["y"]
            bubble_start_x = (
                row_x
                + self.config.question_label_width
                + self.config.question_to_bubble_gap
                + self.config.bubble_radius
            )

            choices = []
            for idx, choice in enumerate(self.config.choices):
                center_x = bubble_start_x + idx * choice_step
                choices.append({
                    "label": choice,
                    "x": center_x,
                    "y": row_y,
                    "radius": self.config.bubble_radius,
                })

            questions.append({
                "question_no": pos["question_no"],
                "row_origin": {"x": row_x, "y": row_y},
                "choices": choices,
            })

        return questions

    def build_template(self, page_width: float, page_height: float) -> dict:
        marker_positions = self.layout.get_marker_positions(page_width, page_height)
        output_name = Path(self.config.output_path).stem

        return {
            "version": "1.0",
            "sheet_id": output_name,
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "page": {
                "width": page_width,
                "height": page_height,
                "unit": "pt",
            },
            "layout": {
                "question_count": self.config.num_questions,
                "choices": list(self.config.choices),
                "bubble_radius": self.config.bubble_radius,
                "row_step": self.layout.get_question_row_height(),
                "choice_step": self.layout.get_choice_center_step(),
            },
            "anchors": marker_positions,
            "student_id": self._build_student_id(page_width, page_height),
            "questions": self._build_questions(page_width, page_height),
        }

    def export(self, page_width: float, page_height: float) -> str:
        output_path = self._resolve_output_path()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        template = self.build_template(page_width, page_height)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(template, f, ensure_ascii=False, indent=2)

        return str(output_path)

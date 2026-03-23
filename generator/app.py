from typing import Sequence

from generator.config import SheetConfig
from generator.helpers import build_output_path
from generator.sheet_generator import BubbleSheetGenerator


class BubbleSheetApp:
    def __init__(
        self,
        title: str = "OptiMark Bubble Sheet",
        num_questions: int = 40,
        choices: Sequence[str] = ("A", "B", "C", "D"),
        column_spacing: int = 25,
        choice_spacing: int = 12,
        output_dir: str = "output",
    ):
        self.title = title
        self.num_questions = num_questions
        self.choices = list(choices)
        self.column_spacing = column_spacing
        self.choice_spacing = choice_spacing
        self.output_dir = output_dir

    def _build_config(self) -> SheetConfig:
        return SheetConfig(
            title=self.title,
            output_path=build_output_path(self.output_dir),
            num_questions=self.num_questions,
            choices=self.choices,
            column_spacing=self.column_spacing,
            choice_spacing=self.choice_spacing,
        )

    def run(self) -> None:
        config = self._build_config()
        generator = BubbleSheetGenerator(config)
        generator.generate()

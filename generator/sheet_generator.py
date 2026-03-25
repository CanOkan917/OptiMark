from reportlab.pdfgen import canvas

from generator.config import SheetConfig
from generator.drawer import BubbleSheetDrawer
from generator.layout import LayoutEngine
from generator.template_exporter import TemplateExporter


class BubbleSheetGenerator:
    def __init__(self, config: SheetConfig):
        self.config = config
        self.width, self.height = config.page_size
        self.canvas = canvas.Canvas(config.output_path, pagesize=config.page_size)

        self.layout = LayoutEngine(config)
        self.drawer = BubbleSheetDrawer(self.canvas, config)
        self.template_exporter = TemplateExporter(config, self.layout)

    def draw_questions(self) -> None:
        choice_center_step = self.layout.get_choice_center_step()
        question_positions = self.layout.get_question_positions(self.width, self.height)

        for pos in question_positions:
            self.drawer.draw_question_row(
                question_no=pos["question_no"],
                x=pos["x"],
                y=pos["y"],
                choice_center_step=choice_center_step,
            )

    def generate(self) -> None:
        marker_positions = self.layout.get_marker_positions(self.width, self.height)

        self.drawer.draw_corner_markers(marker_positions)
        # self.drawer.draw_printable_area_box(self.width, self.height)
        self.drawer.draw_header(self.width, self.height)
        self.draw_questions()
        self.drawer.draw_footer()

        self.canvas.save()
        print(f"Sheet generated: {self.config.output_path}")

        if self.config.export_template_json:
            json_path = self.template_exporter.export(self.width, self.height)
            print(f"Template generated: {json_path}")

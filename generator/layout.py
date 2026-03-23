from math import ceil

from generator.config import SheetConfig


class LayoutEngine:
    def __init__(self, config: SheetConfig):
        self.config = config

    def get_marker_positions(self, page_width, page_height):
        m_x = self.config.margin_x
        m_y = self.config.margin_y
        s = self.config.marker_size

        return {
            "top_left": (m_x, page_height - m_y - s),
            "top_right": (page_width - m_x - s, page_height - m_y - s),
            "bottom_left": (m_x, m_y),
            "bottom_right": (page_width - m_x - s, m_y),
        }

    def get_bubble_diameter(self):
        return self.config.bubble_radius * 2

    def get_choice_center_step(self):
        return self.get_bubble_diameter() + self.config.choice_spacing

    def get_question_row_height(self):
        return self.get_bubble_diameter() + self.config.row_spacing

    def get_question_row_width(self):
        bubble_diameter = self.get_bubble_diameter()
        num_choices = len(self.config.choices)

        if num_choices == 0:
            bubble_block_width = 0
        else:
            bubble_block_width = (
                num_choices * bubble_diameter
                + (num_choices - 1) * self.config.choice_spacing
            )

        return (
            self.config.question_label_width
            + self.config.question_to_bubble_gap
            + bubble_block_width
        )

    def get_total_questions_width(self, num_columns):
        row_width = self.get_question_row_width()
        return (
            num_columns * row_width
            + (num_columns - 1) * self.config.column_spacing
        )

    def get_usable_top(self, page_height):
        return page_height - self.config.margin_y - self.config.header_height - 25

    def get_usable_bottom(self):
        return self.config.margin_y + self.config.footer_height + 20

    def get_usable_vertical_space(self, page_height):
        return self.get_usable_top(page_height) - self.get_usable_bottom()

    def get_student_id_box(self, page_width, page_height):
        if self.config.max_student_ID_len <= 0:
            return None

        digits_count = 10
        top_y = page_height - self.config.margin_y
        grid_top_y = top_y - 50

        col_width = 26
        write_box_height = 24
        bubble_radius = self.config.bubble_radius
        bubble_step = self.get_question_row_height()

        first_bubble_y = grid_top_y - write_box_height - 14
        last_bubble_y = first_bubble_y - (digits_count - 1) * bubble_step
        box_bottom = last_bubble_y - bubble_radius - 4
        box_height = grid_top_y - box_bottom
        box_width = self.config.max_student_ID_len * col_width
        box_left = page_width - self.config.margin_x - box_width

        return {
            "left": box_left,
            "right": box_left + box_width,
            "top": grid_top_y,
            "bottom": box_bottom,
            "width": box_width,
            "height": box_height,
            "col_width": col_width,
            "write_box_height": write_box_height,
            "first_bubble_y": first_bubble_y,
            "bubble_step": bubble_step,
        }

    def get_questions_per_column_capacity(self, page_height):
        row_height = self.get_question_row_height()
        usable_height = self.get_usable_vertical_space(page_height)

        if row_height <= 0:
            raise ValueError("Row height must be positive")

        capacity = int(usable_height // row_height) + 1
        return max(1, capacity)

    def get_auto_num_columns(self, page_width, page_height):
        row_width = self.get_question_row_width()
        usable_width = page_width - 2 * self.config.margin_x

        if row_width <= 0:
            raise ValueError("Row width must be positive")

        max_columns_by_width = int(
            (usable_width + self.config.column_spacing) //
            (row_width + self.config.column_spacing)
        )
        max_columns_by_width = max(1, max_columns_by_width)

        questions_per_column_capacity = self.get_questions_per_column_capacity(page_height)
        required_columns = ceil(self.config.num_questions / questions_per_column_capacity)

        if required_columns > max_columns_by_width:
            raise ValueError(
                "Not enough page space for all questions with current layout settings"
            )

        return required_columns

    def get_question_positions(self, page_width, page_height):
        slots = []

        usable_top = self.get_usable_top(page_height)
        usable_bottom = self.get_usable_bottom()
        student_id_box = self.get_student_id_box(page_width, page_height)

        row_width = self.get_question_row_width()
        row_height = self.get_question_row_height()
        row_index = 0

        while True:
            y = usable_top - row_index * row_height
            if y - self.config.bubble_radius < usable_bottom:
                break

            row_right = page_width - self.config.margin_x
            if student_id_box is not None:
                row_top = y + self.config.bubble_radius
                row_bottom = y - self.config.bubble_radius
                intersects_id_box = (
                    row_top >= student_id_box["bottom"]
                    and row_bottom <= student_id_box["top"]
                )
                if intersects_id_box:
                    row_right = min(row_right, student_id_box["left"] - self.config.column_spacing)

            usable_row_width = row_right - self.config.margin_x
            if usable_row_width >= row_width:
                cols_in_row = int(
                    (usable_row_width + self.config.column_spacing)
                    // (row_width + self.config.column_spacing)
                )

                for col_index in range(max(0, cols_in_row)):
                    x = self.config.margin_x + col_index * (row_width + self.config.column_spacing)
                    if x + row_width > row_right + 1e-6:
                        break
                    slots.append({
                        "x": x,
                        "y": y,
                        "col": col_index,
                        "row": row_index,
                    })

            row_index += 1

        ordered_slots = sorted(slots, key=lambda item: (item["col"], item["row"]))

        if len(ordered_slots) < self.config.num_questions:
            raise ValueError("Not enough page space for all questions without overlapping Student ID area")

        positions = []
        for q_no, slot in enumerate(ordered_slots[:self.config.num_questions], start=1):
            positions.append({
                "question_no": q_no,
                "x": slot["x"],
                "y": slot["y"],
                "col": slot["col"],
                "row": slot["row"],
            })

        return positions

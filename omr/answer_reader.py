import cv2
import numpy as np


def compute_fill_ratio(binary_image: np.ndarray, x, y, r) -> float:
    mask = np.zeros(binary_image.shape[:2], dtype=np.uint8)
    cv2.circle(mask, (x, y), r, 255, -1)

    white_pixels = cv2.countNonZero(cv2.bitwise_and(binary_image, binary_image, mask=mask))

    circle_area = np.pi * (r**2)
    return white_pixels / circle_area


class AnswerReader:
    def __init__(
        self,
        fill_threshold: float = 0.62,
        min_dark_ratio: float = 0.50,
        ambiguity_margin: float = 0.10,
    ):
        self.fill_threshold = fill_threshold
        self.min_dark_ratio = min_dark_ratio
        self.ambiguity_margin = ambiguity_margin

    def read_questions(self, binary_image: np.ndarray, template: dict):
        results = {}
        questions = template.get("questions", [])

        for question in questions:
            question_no = question.get("question_no")
            choices = question.get("choices", [])

            if not choices:
                continue

            scores = {}
            for choice in choices:
                label = choice["label"]
                x = int(round(choice["x"]))
                y = int(round(choice["y"]))
                r = int(round(choice.get("radius", 10)))
                r = max(3, r)

                scores[label] = float(compute_fill_ratio(binary_image, x, y, r))

            sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
            best_label, best_score = sorted_scores[0]
            second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0.0

            if best_score < self.min_dark_ratio:
                answer = "blank"
            elif best_score >= self.fill_threshold and (best_score - second_score) >= self.ambiguity_margin:
                answer = best_label
            else:
                answer = "multiple_or_ambiguous"

            results[question_no] = {
                "answer": answer,
                "scores": scores,
                "best_score": best_score,
                "second_score": second_score,
            }

        return results

    def build_question_debug_overlay(
        self,
        color_image: np.ndarray,
        template: dict,
        question_results: dict,
    ) -> np.ndarray:
        overlay = color_image.copy()
        questions = template.get("questions", [])

        for question in questions:
            q_no = question.get("question_no")
            choices = question.get("choices", [])
            result = question_results.get(q_no) or question_results.get(str(q_no))
            if result is None:
                continue

            selected = result.get("answer")
            score_map = result.get("scores", {})

            for choice in choices:
                label = choice["label"]
                x = int(round(choice["x"]))
                y = int(round(choice["y"]))
                r = int(round(choice.get("radius", 10)))
                r = max(3, r)

                if selected == label:
                    color = (0, 255, 0)
                elif selected in ("blank", "multiple_or_ambiguous"):
                    color = (0, 200, 255)
                else:
                    color = (100, 100, 255)

                cv2.circle(overlay, (x, y), r, color, 2)

                score = score_map.get(label, 0.0)
                cv2.putText(
                    overlay,
                    f"{score:.2f}",
                    (x - r, y - r - 4),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.30,
                    color,
                    1,
                    cv2.LINE_AA,
                )

            first_choice = choices[0] if choices else None
            if first_choice is not None:
                qx = int(round(first_choice["x"])) - 24
                qy = int(round(first_choice["y"])) + 4
                cv2.putText(
                    overlay,
                    f"Q{q_no}:{selected}",
                    (qx, qy),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.33,
                    (255, 120, 0),
                    1,
                    cv2.LINE_AA,
                )

        return overlay

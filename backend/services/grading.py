"""Pure-Python grading logic for OMR scan results.

Deliberately free of any OpenCV / NumPy dependency so it can be unit-tested
without the OMR runtime installed. Input is the structured ``answers.json``
payload produced by ``omr.pipeline.OMRPipeline`` plus the exam answer key.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Sentinel answer values emitted by the OMR answer reader.
BLANK = "blank"
AMBIGUOUS = "multiple_or_ambiguous"


@dataclass
class AnswerKeyEntry:
    question_no: int
    correct_option: str | None
    points: int = 10


@dataclass
class QuestionOutcome:
    question_no: int
    correct_option: str | None
    marked_option: str | None
    state: str  # correct | wrong | blank | ambiguous | unscored
    points_awarded: float


@dataclass
class GradingResult:
    score: float
    max_score: float
    correct_count: int
    wrong_count: int
    blank_count: int
    ambiguous_count: int
    questions: list[QuestionOutcome] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "score": round(self.score, 2),
            "max_score": round(self.max_score, 2),
            "correct_count": self.correct_count,
            "wrong_count": self.wrong_count,
            "blank_count": self.blank_count,
            "ambiguous_count": self.ambiguous_count,
            "questions": [
                {
                    "question_no": q.question_no,
                    "correct_option": q.correct_option,
                    "marked_option": q.marked_option,
                    "state": q.state,
                    "points_awarded": round(q.points_awarded, 2),
                }
                for q in self.questions
            ],
        }


def _normalize_marked(value) -> str | None:
    """Map an OMR answer-reader value to a clean option label or sentinel."""
    if value is None:
        return BLANK
    text = str(value).strip()
    if not text or text == BLANK:
        return BLANK
    if text == AMBIGUOUS:
        return AMBIGUOUS
    return text.upper()


def extract_marked_answers(answers_payload: dict) -> dict[int, str | None]:
    """Flatten OMR ``question_results`` into ``{question_no: marked_label}``."""
    question_results = answers_payload.get("question_results") or {}
    marked: dict[int, str | None] = {}
    for raw_no, result in question_results.items():
        try:
            question_no = int(raw_no)
        except (TypeError, ValueError):
            continue
        answer = result.get("answer") if isinstance(result, dict) else result
        marked[question_no] = _normalize_marked(answer)
    return marked


def grade(
    answer_key: list[AnswerKeyEntry],
    marked_answers: dict[int, str | None],
    scoring_formula: str = "standard",
    option_count: int = 4,
) -> GradingResult:
    """Grade a single sheet.

    ``standard``  → correct earns full points, wrong/blank earn nothing.
    ``penalty``   → correct earns full points, every wrong answer deducts
                    ``points / (option_count - 1)`` (classic negative marking).
                    Blank and ambiguous answers are neutral (0).
    """
    penalty_divisor = max(option_count - 1, 1)

    score = 0.0
    max_score = 0.0
    correct = wrong = blank = ambiguous = 0
    outcomes: list[QuestionOutcome] = []

    for entry in answer_key:
        points = float(entry.points)
        correct_option = (entry.correct_option or "").strip().upper() or None
        marked = marked_answers.get(entry.question_no)

        if correct_option is None:
            # No answer key for this question — cannot be scored.
            outcomes.append(
                QuestionOutcome(entry.question_no, None, marked, "unscored", 0.0)
            )
            continue

        max_score += points

        if marked == BLANK or marked is None:
            blank += 1
            state, awarded = "blank", 0.0
        elif marked == AMBIGUOUS:
            ambiguous += 1
            state, awarded = "ambiguous", 0.0
        elif marked == correct_option:
            correct += 1
            state, awarded = "correct", points
        else:
            wrong += 1
            state = "wrong"
            awarded = -(points / penalty_divisor) if scoring_formula == "penalty" else 0.0

        score += awarded
        outcomes.append(
            QuestionOutcome(entry.question_no, correct_option, marked, state, awarded)
        )

    # Never report a negative total score.
    score = max(score, 0.0)

    return GradingResult(
        score=score,
        max_score=max_score,
        correct_count=correct,
        wrong_count=wrong,
        blank_count=blank,
        ambiguous_count=ambiguous,
        questions=outcomes,
    )

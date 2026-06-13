"""Unit tests for the pure-Python grading logic (no OpenCV needed).

Run with:  python -m backend.tests.test_grading
"""
from backend.services.grading import (
    AnswerKeyEntry,
    extract_marked_answers,
    grade,
)


def _key():
    return [
        AnswerKeyEntry(question_no=1, correct_option="A", points=10),
        AnswerKeyEntry(question_no=2, correct_option="B", points=10),
        AnswerKeyEntry(question_no=3, correct_option="C", points=10),
        AnswerKeyEntry(question_no=4, correct_option="D", points=10),
    ]


def test_standard_scoring():
    marked = {1: "A", 2: "B", 3: "X", 4: "blank"}
    result = grade(_key(), marked, scoring_formula="standard", option_count=4)
    assert result.score == 20.0, result.score
    assert result.max_score == 40.0
    assert result.correct_count == 2
    assert result.wrong_count == 1
    assert result.blank_count == 1


def test_penalty_scoring_deducts_wrong():
    marked = {1: "A", 2: "B", 3: "X", 4: "Y"}  # 2 correct, 2 wrong
    result = grade(_key(), marked, scoring_formula="penalty", option_count=4)
    # 2*10 correct - 2*(10/3) wrong = 20 - 6.666...
    assert abs(result.score - (20 - 2 * (10 / 3))) < 1e-6, result.score


def test_score_never_negative():
    marked = {1: "Z", 2: "Z", 3: "Z", 4: "Z"}  # all wrong
    result = grade(_key(), marked, scoring_formula="penalty", option_count=4)
    assert result.score == 0.0


def test_ambiguous_is_neutral():
    marked = {1: "multiple_or_ambiguous", 2: "B", 3: "C", 4: "D"}
    result = grade(_key(), marked, scoring_formula="standard", option_count=4)
    assert result.ambiguous_count == 1
    assert result.correct_count == 3
    assert result.score == 30.0


def test_missing_answer_key_is_unscored():
    key = [AnswerKeyEntry(question_no=1, correct_option=None, points=10)]
    result = grade(key, {1: "A"}, scoring_formula="standard", option_count=4)
    assert result.max_score == 0.0
    assert result.questions[0].state == "unscored"


def test_extract_marked_answers_from_omr_payload():
    payload = {
        "question_results": {
            "1": {"answer": "a"},
            "2": {"answer": "blank"},
            "3": {"answer": "multiple_or_ambiguous"},
        }
    }
    marked = extract_marked_answers(payload)
    assert marked == {1: "A", 2: "blank", 3: "multiple_or_ambiguous"}


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    raise SystemExit(1 if failures else 0)

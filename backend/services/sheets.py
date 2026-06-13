from datetime import datetime, timezone
import json
import os
from pathlib import Path
from urllib.parse import urlencode

from fastapi import HTTPException, Request, status

from generator.config import SheetConfig
from generator.sheet_generator import BubbleSheetGenerator

from ..models import Exam, ExamSheetTemplate
from ..schemas import ExamSheetGenerationOut, ExamSheetTemplateOut
from ..security import create_token
from .ids import to_exam_public_id, to_exam_sheet_template_public_id


DOWNLOAD_TOKEN_PURPOSE = "exam_sheet_pdf_download"
DOWNLOAD_TOKEN_EXPIRE_MINUTES = int(os.getenv("SHEET_DOWNLOAD_LINK_EXPIRE_MINUTES", "60"))
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def get_sheet_output_dir() -> Path:
    configured_output_dir = os.getenv("SHEET_OUTPUT_DIR", "").strip()
    if configured_output_dir:
        candidate = Path(configured_output_dir)
        if not candidate.is_absolute():
            candidate = PROJECT_ROOT / candidate
    else:
        candidate = PROJECT_ROOT / "output" / "sheets"
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate.resolve()


def get_sheet_choice_labels(option_count: int) -> list[str]:
    return ["A", "B", "C", "D"] if option_count == 4 else ["A", "B", "C", "D", "E"]


def generate_sheet_artifacts_for_exam(
    exam: Exam,
    question_count: int,
    option_count: int,
) -> tuple[str, str]:
    output_dir = get_sheet_output_dir()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    base_filename = f"exam_{exam.id}_{timestamp}"
    pdf_path = output_dir / f"{base_filename}.pdf"
    template_path = output_dir / f"{base_filename}.json"

    config = SheetConfig(
        title=exam.title,
        output_path=str(pdf_path),
        num_questions=question_count,
        choices=get_sheet_choice_labels(option_count),
        export_template_json=True,
        template_output_path=str(template_path),
    )
    try:
        BubbleSheetGenerator(config).generate()
    except Exception as exc:
        pdf_path.unlink(missing_ok=True)
        template_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bubble sheet artifacts could not be generated",
        ) from exc

    if not template_path.exists():
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template JSON could not be generated",
        )

    template_json_raw = template_path.read_text(encoding="utf-8")
    template_path.unlink(missing_ok=True)

    try:
        template_json = json.dumps(json.loads(template_json_raw), ensure_ascii=False)
    except json.JSONDecodeError as exc:
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generated template JSON is invalid",
        ) from exc

    return str(pdf_path), template_json


def build_exam_sheet_download_url(
    request: Request,
    exam_public_id: str,
    template_public_id: str,
    download_token: str,
) -> str:
    base_url = str(
        request.url_for(
            "download_exam_sheet_template_pdf",
            exam_id=exam_public_id,
            template_id=template_public_id,
        )
    )
    query = urlencode({"token": download_token})
    return f"{base_url}?{query}"


def serialize_exam_sheet_generation(
    template: ExamSheetTemplate,
    exam: Exam,
    download_url: str,
) -> ExamSheetGenerationOut:
    return ExamSheetGenerationOut(
        id=to_exam_sheet_template_public_id(template.id),
        exam_id=to_exam_public_id(exam.id),
        academic_year=exam.academic_year,
        question_count=template.question_count,
        option_count=template.option_count,  # type: ignore[arg-type]
        created_at=template.created_at,
        download_url=download_url,
    )


def serialize_exam_sheet_template(
    template: ExamSheetTemplate,
    exam: Exam,
    download_url: str,
) -> ExamSheetTemplateOut:
    return ExamSheetTemplateOut(
        id=to_exam_sheet_template_public_id(template.id),
        exam_id=to_exam_public_id(exam.id),
        question_count=template.question_count,
        option_count=template.option_count,  # type: ignore[arg-type]
        created_at=template.created_at,
        download_url=download_url,
    )


def build_sheet_template_download_url(
    request: Request,
    exam: Exam,
    template: ExamSheetTemplate,
) -> str:
    download_token = create_token(
        {
            "purpose": DOWNLOAD_TOKEN_PURPOSE,
            "exam_id": exam.id,
            "template_id": template.id,
        },
        expires_minutes=DOWNLOAD_TOKEN_EXPIRE_MINUTES,
    )
    return build_exam_sheet_download_url(
        request=request,
        exam_public_id=to_exam_public_id(exam.id),
        template_public_id=to_exam_sheet_template_public_id(template.id),
        download_token=download_token,
    )

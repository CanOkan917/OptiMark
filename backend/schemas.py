from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    full_name: str | None = Field(default=None, max_length=120)
    school_name: str | None = Field(default=None, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    full_name: str | None
    role: str
    school_name: str | None
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class DashboardSummary(BaseModel):
    total_users: int
    active_users: int
    admins: int
    school_admins: int
    analysts: int
    teachers: int
    students: int


class AcademicYearsResponse(BaseModel):
    items: list[str]


class UserPreferenceOut(BaseModel):
    selected_academic_year: str


class UserPreferenceUpdate(BaseModel):
    selected_academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")


class TeacherItem(BaseModel):
    id: str
    name: str
    email: str


class TeachersResponse(BaseModel):
    items: list[TeacherItem]


class CourseCreate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    name: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=32)
    description: str | None = None
    teacher_ids: list[str] = Field(min_length=1)


class CoursePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    code: str | None = Field(default=None, min_length=1, max_length=32)
    description: str | None = None
    teacher_ids: list[str] | None = None


class CourseOut(BaseModel):
    id: str
    academic_year: str
    name: str
    code: str
    description: str | None
    teacher_ids: list[str]
    created_at: datetime


class CoursesResponse(BaseModel):
    items: list[CourseOut]


class ExamQuestionPayload(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1)
    correct_option: Literal["A", "B", "C", "D", "E"]


class ExamCreate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    course_id: str
    title: str = Field(min_length=1, max_length=200)
    exam_date: date
    duration_minutes: int = Field(ge=1, le=600)
    option_count: Literal[4, 5]
    scoring_formula: Literal["standard", "penalty"]
    assigned_student_groups: list[str] = Field(default_factory=list)
    bubble_sheet_config: dict[str, bool | str | int] = Field(default_factory=dict)
    questions: list[ExamQuestionPayload] = Field(default_factory=list)


class ExamPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    exam_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    option_count: Literal[4, 5] | None = None
    scoring_formula: Literal["standard", "penalty"] | None = None
    assigned_student_groups: list[str] | None = None
    bubble_sheet_config: dict[str, bool | str | int] | None = None
    publish_status: Literal["draft", "published"] | None = None


class ExamPublishPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    exam_date: date
    duration_minutes: int = Field(ge=1, le=600)
    scoring_formula: Literal["standard", "penalty"]
    assigned_student_groups: list[str] = Field(min_length=1)
    bubble_sheet_config: dict[str, bool | str | int] = Field(default_factory=dict)


class ExamQuestionsUpsert(BaseModel):
    questions: list[ExamQuestionPayload]


class ExamQuestionOut(BaseModel):
    id: str
    text: str
    correct_option: Literal["A", "B", "C", "D", "E"]


class ExamOut(BaseModel):
    id: str
    course_id: str
    title: str
    exam_date: date
    duration_minutes: int
    option_count: Literal[4, 5]
    scoring_formula: Literal["standard", "penalty"]
    publish_status: Literal["draft", "published"]
    published_at: datetime | None
    assigned_student_groups: list[str]
    bubble_sheet_config: dict[str, bool | str | int]
    questions: list[ExamQuestionOut]
    bubble_sheet_generated: bool
    created_at: datetime


class ExamsResponse(BaseModel):
    items: list[ExamOut]


class ExamSheetGenerationOut(BaseModel):
    id: str
    exam_id: str
    academic_year: str
    question_count: int
    option_count: Literal[4, 5]
    created_at: datetime
    download_url: str


class ExamSheetTemplateOut(BaseModel):
    id: str
    exam_id: str
    question_count: int
    option_count: Literal[4, 5]
    created_at: datetime
    download_url: str


class ExamOverviewMetricsOut(BaseModel):
    assigned_student_count: int
    submitted_answer_count: int
    graded_submission_count: int
    pending_grading_count: int
    absent_count: int
    average_score: float | None
    participation_rate: float


class ExamOverviewOut(BaseModel):
    exam: ExamOut
    sheet_templates: list[ExamSheetTemplateOut]
    metrics: ExamOverviewMetricsOut


class ExamBuilderOptionPayload(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    label: Literal["A", "B", "C", "D", "E"]
    text: str = ""


class ExamBuilderQuestionPayload(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    text: str = ""
    options: list[ExamBuilderOptionPayload] = Field(min_length=2)
    correct_option_id: str | None = Field(default=None, max_length=64)
    points: int = Field(default=10, ge=0, le=1000)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    bloom_level: Literal["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] = "Understand"
    tags: list[str] = Field(default_factory=list)


class ExamBuilderUpsert(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    exam_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    option_count: Literal[4, 5] | None = None
    scoring_formula: Literal["standard", "penalty"] | None = None
    questions: list[ExamBuilderQuestionPayload] = Field(default_factory=list)


class ExamBuilderMetaPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    exam_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    option_count: Literal[4, 5] | None = None
    scoring_formula: Literal["standard", "penalty"] | None = None


class ExamBuilderOut(BaseModel):
    id: str
    course_id: str
    title: str
    exam_date: date
    duration_minutes: int
    option_count: Literal[4, 5]
    scoring_formula: Literal["standard", "penalty"]
    bubble_sheet_generated: bool
    questions: list[ExamBuilderQuestionPayload]
    total_question_count: int
    complete_question_count: int
    created_at: datetime
    updated_at: datetime


class ExamBuilderQuestionSave(BaseModel):
    question_order: int = Field(ge=1)
    question: ExamBuilderQuestionPayload


class StudentCreate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    student_no: str = Field(min_length=1, max_length=64)
    full_name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    grade_level: str = Field(min_length=1, max_length=32)
    status: Literal["active", "inactive"] = "active"
    group_ids: list[str] = Field(default_factory=list)


class StudentPatch(BaseModel):
    student_no: str | None = Field(default=None, min_length=1, max_length=64)
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    grade_level: str | None = Field(default=None, min_length=1, max_length=32)
    status: Literal["active", "inactive"] | None = None
    group_ids: list[str] | None = None


class StudentOut(BaseModel):
    id: str
    academic_year: str
    student_no: str
    full_name: str
    email: str
    grade_level: str
    group_ids: list[str]
    status: Literal["active", "inactive"]
    created_at: datetime
    updated_at: datetime


class StudentsResponse(BaseModel):
    items: list[StudentOut]


class StudentGroupCreate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=160)
    advisor_name: str = Field(min_length=1, max_length=160)
    capacity: int = Field(ge=1, le=1000)


class StudentGroupPatch(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    advisor_name: str | None = Field(default=None, min_length=1, max_length=160)
    capacity: int | None = Field(default=None, ge=1, le=1000)


class StudentGroupOut(BaseModel):
    id: str
    academic_year: str
    code: str
    name: str
    advisor_name: str
    capacity: int
    student_count: int
    created_at: datetime
    updated_at: datetime


class StudentGroupsResponse(BaseModel):
    items: list[StudentGroupOut]


class StudentImportJobCreate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    file_name: str = Field(min_length=1, max_length=255)
    total_rows: int = Field(ge=0)
    imported_rows: int = Field(ge=0)
    failed_rows: int = Field(ge=0)
    status: Literal["completed", "partial", "failed"] = "completed"


class StudentImportJobOut(BaseModel):
    id: str
    academic_year: str
    file_name: str
    created_at: datetime
    total_rows: int
    imported_rows: int
    failed_rows: int
    status: Literal["completed", "partial", "failed"]


class StudentImportJobsResponse(BaseModel):
    items: list[StudentImportJobOut]


class StudentCsvImportRequest(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    file_name: str = Field(min_length=1, max_length=255)
    csv_content: str = Field(min_length=1)


class StudentCsvImportResponse(BaseModel):
    job: StudentImportJobOut
    total_rows: int
    created_count: int
    updated_count: int
    failed_count: int
    errors: list[str] = Field(default_factory=list)

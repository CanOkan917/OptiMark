import type { Exam, ExamQuestion, ScoringFormula } from "../academic/types"
import { apiRequest } from "./client"

interface ApiExamQuestion {
  id: string
  text: string
  correct_option: "A" | "B" | "C" | "D" | "E"
}

export interface ApiExamBuilderOption {
  id: string
  label: "A" | "B" | "C" | "D" | "E"
  text: string
}

export interface ApiExamBuilderQuestion {
  id: string
  text: string
  options: ApiExamBuilderOption[]
  correct_option_id: string | null
  points: number
  difficulty: "Easy" | "Medium" | "Hard"
  bloom_level: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create"
  tags: string[]
}

export interface ApiExamBuilder {
  id: string
  course_id: string
  title: string
  exam_date: string
  duration_minutes: number
  option_count: 4 | 5
  scoring_formula: ScoringFormula
  bubble_sheet_generated: boolean
  questions: ApiExamBuilderQuestion[]
  total_question_count: number
  complete_question_count: number
  created_at: string
  updated_at: string
}

interface UpsertExamBuilderQuestionPayload {
  question_order: number
  question: ApiExamBuilderQuestion
}

interface UpsertExamBuilderPayload {
  title?: string
  exam_date?: string
  duration_minutes?: number
  option_count?: 4 | 5
  scoring_formula?: ScoringFormula
  questions: ApiExamBuilderQuestion[]
}

interface ApiExam {
  id: string
  academic_year?: string
  course_id: string
  title: string
  exam_date: string
  duration_minutes: number
  option_count: 4 | 5
  scoring_formula: ScoringFormula
  publish_status: "draft" | "published"
  published_at: string | null
  assigned_student_groups: string[]
  bubble_sheet_config: Record<string, string | number | boolean>
  questions: ApiExamQuestion[]
  bubble_sheet_generated: boolean
  created_at: string
}

interface ExamsResponse {
  items: ApiExam[]
}

interface CreateExamPayload {
  academic_year: string
  course_id: string
  title: string
  exam_date: string
  duration_minutes: number
  option_count: 4 | 5
  scoring_formula: ScoringFormula
  questions: ExamQuestion[]
}

interface UpdateExamPayload {
  title?: string
  exam_date?: string
  duration_minutes?: number
  option_count?: 4 | 5
  scoring_formula?: ScoringFormula
  assigned_student_groups?: string[]
  bubble_sheet_config?: Record<string, string | number | boolean>
  publish_status?: "draft" | "published"
}

interface UpdateQuestionsPayload {
  questions: ExamQuestion[]
}

function mapQuestion(question: ApiExamQuestion): ExamQuestion {
  return {
    id: question.id,
    text: question.text,
    correctOption: question.correct_option,
  }
}

function mapExam(apiExam: ApiExam): Exam {
  return {
    id: apiExam.id,
    academicYear: apiExam.academic_year ?? "",
    courseId: apiExam.course_id,
    title: apiExam.title,
    examDate: apiExam.exam_date,
    durationMinutes: apiExam.duration_minutes,
    optionCount: apiExam.option_count,
    scoringFormula: apiExam.scoring_formula,
    publishStatus: apiExam.publish_status,
    publishedAt: apiExam.published_at,
    assignedStudentGroups: apiExam.assigned_student_groups ?? [],
    bubbleSheetConfig: apiExam.bubble_sheet_config ?? {},
    questions: (apiExam.questions ?? []).map(mapQuestion),
    bubbleSheetGenerated: apiExam.bubble_sheet_generated,
    createdAt: apiExam.created_at,
  }
}

function toApiQuestion(question: ExamQuestion): ApiExamQuestion {
  return {
    id: question.id,
    text: question.text,
    correct_option: question.correctOption,
  }
}

export async function createExam(payload: CreateExamPayload): Promise<Exam> {
  const response = await apiRequest<ApiExam>("/exams", {
    method: "POST",
    auth: true,
    body: {
      ...payload,
      questions: payload.questions.map(toApiQuestion),
    },
  })
  return mapExam(response)
}

export async function getExams(academicYear: string, courseId?: string, search?: string): Promise<Exam[]> {
  const params = new URLSearchParams({ academic_year: academicYear })
  if (courseId && courseId !== "all") {
    params.set("course_id", courseId)
  }
  if (search?.trim()) {
    params.set("search", search.trim())
  }
  const response = await apiRequest<ExamsResponse>(`/exams?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
  return response.items.map(mapExam)
}

export async function getExamById(examId: string, academicYear: string): Promise<Exam> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiExam>(`/exams/${encodeURIComponent(examId)}?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
  return mapExam(response)
}

export async function updateExamById(examId: string, academicYear: string, payload: UpdateExamPayload): Promise<Exam> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiExam>(`/exams/${encodeURIComponent(examId)}?${params.toString()}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  })
  return mapExam(response)
}

export async function updateExamQuestions(examId: string, academicYear: string, payload: UpdateQuestionsPayload): Promise<Exam> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiExam>(`/exams/${encodeURIComponent(examId)}/questions?${params.toString()}`, {
    method: "PUT",
    auth: true,
    body: {
      questions: payload.questions.map(toApiQuestion),
    },
  })
  return mapExam(response)
}

export async function getExamBuilderById(examId: string, academicYear: string): Promise<ApiExamBuilder> {
  const params = new URLSearchParams({ academic_year: academicYear })
  return apiRequest<ApiExamBuilder>(`/exams/${encodeURIComponent(examId)}/builder?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
}

export async function upsertExamBuilderQuestion(
  examId: string,
  academicYear: string,
  questionId: string,
  payload: UpsertExamBuilderQuestionPayload,
): Promise<ApiExamBuilder> {
  const params = new URLSearchParams({ academic_year: academicYear })
  return apiRequest<ApiExamBuilder>(
    `/exams/${encodeURIComponent(examId)}/builder/questions/${encodeURIComponent(questionId)}?${params.toString()}`,
    {
      method: "PUT",
      auth: true,
      body: payload,
    },
  )
}

export async function upsertExamBuilder(
  examId: string,
  academicYear: string,
  payload: UpsertExamBuilderPayload,
): Promise<ApiExamBuilder> {
  const params = new URLSearchParams({ academic_year: academicYear })
  return apiRequest<ApiExamBuilder>(`/exams/${encodeURIComponent(examId)}/builder?${params.toString()}`, {
    method: "PUT",
    auth: true,
    body: payload,
  })
}

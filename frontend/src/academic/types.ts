export type OptionLabel = "A" | "B" | "C" | "D" | "E"
export type ScoringFormula = "standard" | "penalty"

export interface Teacher {
    id: string
    name: string
    email: string
}

export interface Course {
    id: string
    academicYear: string
    name: string
    code: string
    description: string
    teacherIds: string[]
    createdAt: string
}

export interface ExamQuestion {
    id: string
    text: string
    correctOption: OptionLabel
}

export interface Exam {
    id: string
    academicYear: string
    courseId: string
    title: string
    examDate: string
    durationMinutes: number
    optionCount: 4 | 5
    scoringFormula: ScoringFormula
    publishStatus: "draft" | "published"
    publishedAt: string | null
    assignedStudentGroups: string[]
    bubbleSheetConfig: Record<string, string | number | boolean>
    questions: ExamQuestion[]
    bubbleSheetGenerated: boolean
    createdAt: string
}

export interface AcademicState {
    teachers: Teacher[]
    courses: Course[]
    exams: Exam[]
}

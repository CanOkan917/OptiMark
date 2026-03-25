import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { AcademicState, Course, Exam, ExamQuestion, Teacher } from "./types"

const STORAGE_KEY = "optimark_academic_state_v1"

const defaultState: AcademicState = {
  teachers: [
    { id: "t-1", name: "John Carter", email: "john.carter@school.com" },
    { id: "t-2", name: "Alice Moore", email: "alice.moore@school.com" },
  ],
  courses: [],
  exams: [],
}

interface CreateCourseInput {
  name: string
  code: string
  description: string
  teacherIds: string[]
}

interface CreateExamInput {
  courseId: string
  title: string
  examDate: string
  durationMinutes: number
  optionCount: 4 | 5
  questions: ExamQuestion[]
}

interface AcademicContextValue {
  teachers: Teacher[]
  courses: Course[]
  exams: Exam[]
  addTeacher: (payload: Omit<Teacher, "id">) => Teacher
  addCourse: (payload: CreateCourseInput) => Course
  createExam: (payload: CreateExamInput) => Exam
  getCourseById: (courseId: string) => Course | undefined
  getTeachersByIds: (teacherIds: string[]) => Teacher[]
  getExamsByCourse: (courseId: string) => Exam[]
}

const AcademicContext = createContext<AcademicContextValue | undefined>(undefined)

function generateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function loadState(): AcademicState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultState

  try {
    const parsed = JSON.parse(raw) as AcademicState
    return {
      teachers: parsed.teachers ?? [],
      courses: parsed.courses ?? [],
      exams: parsed.exams ?? [],
    }
  } catch {
    return defaultState
  }
}

function persistState(state: AcademicState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function AcademicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AcademicState>(loadState)

  const addTeacher = (payload: Omit<Teacher, "id">) => {
    const teacher: Teacher = {
      id: generateId("teacher"),
      ...payload,
    }

    setState((current) => {
      const next = { ...current, teachers: [teacher, ...current.teachers] }
      persistState(next)
      return next
    })

    return teacher
  }

  const addCourse = (payload: CreateCourseInput) => {
    const course: Course = {
      id: generateId("course"),
      ...payload,
      createdAt: new Date().toISOString(),
    }

    setState((current) => {
      const next = { ...current, courses: [course, ...current.courses] }
      persistState(next)
      return next
    })

    return course
  }

  const createExam = (payload: CreateExamInput) => {
    const exam: Exam = {
      id: generateId("exam"),
      ...payload,
      bubbleSheetGenerated: true,
      createdAt: new Date().toISOString(),
    }

    setState((current) => {
      const next = { ...current, exams: [exam, ...current.exams] }
      persistState(next)
      return next
    })

    return exam
  }

  const getCourseById = (courseId: string) => state.courses.find((course) => course.id === courseId)
  const getTeachersByIds = (teacherIds: string[]) => state.teachers.filter((teacher) => teacherIds.includes(teacher.id))
  const getExamsByCourse = (courseId: string) => state.exams.filter((exam) => exam.courseId === courseId)

  const value = useMemo<AcademicContextValue>(
    () => ({
      teachers: state.teachers,
      courses: state.courses,
      exams: state.exams,
      addTeacher,
      addCourse,
      createExam,
      getCourseById,
      getTeachersByIds,
      getExamsByCourse,
    }),
    [state],
  )

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>
}

export function useAcademic() {
  const context = useContext(AcademicContext)
  if (!context) {
    throw new Error("useAcademic must be used within AcademicProvider")
  }
  return context
}

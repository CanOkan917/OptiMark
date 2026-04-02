import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react"
import {ApiError} from "../api/client"
import {getAcademicYears, getMyPreferences, updateMyPreferences} from "../api/academic"
import {createCourse, deleteCourseById, getCourseById as getCourseByIdApi, getCourses, getTeachers, updateCourseById} from "../api/courses"
import {createExam as createExamApi, getExamById, getExams, updateExamById, updateExamQuestions} from "../api/exams"
import {useAuth} from "../auth/AuthContext"
import type {AcademicState, Course, Exam, ExamQuestion, ScoringFormula, Teacher} from "./types"

const defaultState: AcademicState = {teachers: [], courses: [], exams: []}

interface CreateCourseInput {
    name: string
    code: string
    description: string
    teacherIds: string[]
}

interface UpdateCourseInput {
    name?: string
    description?: string
    teacherIds?: string[]
}

interface CreateExamInput {
    courseId: string
    title: string
    examDate: string
    durationMinutes: number
    optionCount: 4 | 5
    scoringFormula: ScoringFormula
    questions: ExamQuestion[]
}

interface UpdateExamInput {
    title?: string
    examDate?: string
    durationMinutes?: number
    optionCount?: 4 | 5
    scoringFormula?: ScoringFormula
    assignedStudentGroups?: string[]
    bubbleSheetConfig?: Record<string, string | number | boolean>
    publishStatus?: "draft" | "published"
}

interface AcademicContextValue {
    teachers: Teacher[]
    courses: Course[]
    exams: Exam[]
    isAcademicYearLoading: boolean
    isTeachersLoading: boolean
    isCoursesLoading: boolean
    isExamsLoading: boolean
    selectedAcademicYear: string
    academicYearOptions: string[]
    setSelectedAcademicYear: (year: string) => void
    refreshTeachers: (search?: string) => Promise<void>
    refreshCourses: (search?: string) => Promise<void>
    refreshExams: (courseId?: string, search?: string) => Promise<void>
    addTeacher: (payload: Omit<Teacher, "id">) => Teacher
    addCourse: (payload: CreateCourseInput) => Promise<Course>
    updateCourse: (courseId: string, payload: UpdateCourseInput) => Promise<Course>
    deleteCourse: (courseId: string) => Promise<void>
    fetchCourseById: (courseId: string) => Promise<Course | undefined>
    createExam: (payload: CreateExamInput) => Promise<Exam>
    fetchExamById: (examId: string) => Promise<Exam | undefined>
    updateExam: (examId: string, payload: UpdateExamInput) => Promise<Exam>
    setExamQuestions: (examId: string, questions: ExamQuestion[]) => Promise<Exam>
    getCourseById: (courseId: string) => Course | undefined
    getTeachersByIds: (teacherIds: string[]) => Teacher[]
    getExamsByCourse: (courseId: string) => Exam[]
}

const AcademicContext = createContext<AcademicContextValue | undefined>(undefined)

function generateId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`
}

function getCurrentAcademicYear() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const startYear = month >= 8 ? year : year - 1
    return `${startYear}-${startYear + 1}`
}

function buildAcademicYearOptions() {
    const [startYearText] = getCurrentAcademicYear().split("-")
    const startYear = Number(startYearText)
    return Array.from({length: 6}, (_, index) => {
        const value = startYear + 1 - index
        return `${value}-${value + 1}`
    })
}

export function AcademicProvider({children}: { children: ReactNode }) {
    const {isAuthenticated, isInitializing} = useAuth()
    const fallbackAcademicYearOptions = useMemo(() => buildAcademicYearOptions(), [])
    const [academicYearOptions, setAcademicYearOptions] = useState<string[]>(fallbackAcademicYearOptions)
    const [selectedAcademicYear, setSelectedAcademicYearState] = useState<string>("")
    const [isAcademicYearLoading, setIsAcademicYearLoading] = useState(true)
    const [isTeachersLoading, setIsTeachersLoading] = useState(false)
    const [isCoursesLoading, setIsCoursesLoading] = useState(false)
    const [isExamsLoading, setIsExamsLoading] = useState(false)
    const [state, setState] = useState<AcademicState>(defaultState)

    const setSelectedAcademicYear = useCallback((year: string) => {
        if (!academicYearOptions.includes(year)) return
        const previous = selectedAcademicYear
        setSelectedAcademicYearState(year)

        if (!isAuthenticated || isInitializing) {
            return
        }

        void (async () => {
            try {
                await updateMyPreferences({selected_academic_year: year})
            } catch {
                setSelectedAcademicYearState(previous)
            }
        })()
    }, [academicYearOptions, isAuthenticated, isInitializing, selectedAcademicYear])

    const refreshTeachers = useCallback(async (search?: string) => {
        if (!isAuthenticated || isInitializing || !selectedAcademicYear || isAcademicYearLoading) {
            setState((current) => ({...current, teachers: []}))
            return
        }

        setIsTeachersLoading(true)
        try {
            const teachers = await getTeachers(selectedAcademicYear, search)
            setState((current) => ({...current, teachers}))
        } finally {
            setIsTeachersLoading(false)
        }
    }, [isAcademicYearLoading, isAuthenticated, isInitializing, selectedAcademicYear])

    const refreshCourses = useCallback(async (search?: string) => {
        if (!isAuthenticated || isInitializing || !selectedAcademicYear || isAcademicYearLoading) {
            setState((current) => ({...current, courses: []}))
            return
        }

        setIsCoursesLoading(true)
        try {
            const courses = await getCourses(selectedAcademicYear, search)
            setState((current) => ({...current, courses}))
        } finally {
            setIsCoursesLoading(false)
        }
    }, [isAcademicYearLoading, isAuthenticated, isInitializing, selectedAcademicYear])

    const refreshExams = useCallback(async (courseId?: string, search?: string) => {
        if (!isAuthenticated || isInitializing || !selectedAcademicYear || isAcademicYearLoading) {
            setState((current) => ({...current, exams: []}))
            return
        }

        setIsExamsLoading(true)
        try {
            const exams = await getExams(selectedAcademicYear, courseId, search)
            setState((current) => ({...current, exams}))
        } finally {
            setIsExamsLoading(false)
        }
    }, [isAcademicYearLoading, isAuthenticated, isInitializing, selectedAcademicYear])

    useEffect(() => {
        if (isInitializing) {
            setIsAcademicYearLoading(true)
            return
        }

        if (!isAuthenticated) {
            setAcademicYearOptions(fallbackAcademicYearOptions)
            setSelectedAcademicYearState(fallbackAcademicYearOptions[0] ?? getCurrentAcademicYear())
            setIsAcademicYearLoading(false)
            setState((current) => ({...current, teachers: [], courses: []}))
            return
        }

        let cancelled = false

        const syncAcademicYears = async () => {
            setIsAcademicYearLoading(true)
            try {
                const [yearsResponse, preferencesResponse] = await Promise.all([
                    getAcademicYears(),
                    getMyPreferences(),
                ])

                if (cancelled) return

                const options = yearsResponse.items.length > 0 ? yearsResponse.items : fallbackAcademicYearOptions
                const preferredYear = preferencesResponse.selected_academic_year
                const selectedYear = options.includes(preferredYear) ? preferredYear : (options[0] ?? getCurrentAcademicYear())

                setAcademicYearOptions(options)
                setSelectedAcademicYearState(selectedYear)
            } catch (error) {
                if (cancelled) return

                if (!(error instanceof ApiError && error.status === 401)) {
                    setAcademicYearOptions(fallbackAcademicYearOptions)
                }
            } finally {
                if (!cancelled) {
                    setIsAcademicYearLoading(false)
                }
            }
        }

        void syncAcademicYears()

        return () => {
            cancelled = true
        }
    }, [fallbackAcademicYearOptions, isAuthenticated, isInitializing])

    const addTeacher = (payload: Omit<Teacher, "id">) => {
        const teacher: Teacher = {
            id: generateId("teacher"),
            ...payload,
        }

        setState((current) => {
            return {...current, teachers: [teacher, ...current.teachers]}
        })

        return teacher
    }

    const addCourse = useCallback(async (payload: CreateCourseInput) => {
        const course = await createCourse({
            academic_year: selectedAcademicYear,
            name: payload.name,
            code: payload.code,
            description: payload.description,
            teacher_ids: payload.teacherIds,
        })

        setState((current) => ({...current, courses: [course, ...current.courses.filter((item) => item.id !== course.id)]}))
        return course
    }, [selectedAcademicYear])

    const updateCourse = useCallback(async (courseId: string, payload: UpdateCourseInput) => {
        const course = await updateCourseById(courseId, selectedAcademicYear, {
            name: payload.name,
            description: payload.description,
            teacher_ids: payload.teacherIds,
        })

        setState((current) => ({
            ...current,
            courses: current.courses.map((item) => (item.id === course.id ? course : item)),
        }))
        return course
    }, [selectedAcademicYear])

    const deleteCourse = useCallback(async (courseId: string) => {
        await deleteCourseById(courseId, selectedAcademicYear)
        setState((current) => ({
            ...current,
            courses: current.courses.filter((item) => item.id !== courseId),
        }))
    }, [selectedAcademicYear])

    const fetchCourseById = useCallback(async (courseId: string) => {
        const course = await getCourseByIdApi(courseId, selectedAcademicYear)
        setState((current) => ({
            ...current,
            courses: [course, ...current.courses.filter((item) => item.id !== course.id)],
        }))
        return course
    }, [selectedAcademicYear])

    const createExam = useCallback(async (payload: CreateExamInput) => {
        const exam = await createExamApi({
            academic_year: selectedAcademicYear,
            course_id: payload.courseId,
            title: payload.title,
            exam_date: payload.examDate,
            duration_minutes: payload.durationMinutes,
            option_count: payload.optionCount,
            scoring_formula: payload.scoringFormula,
            questions: payload.questions,
        })

        setState((current) => ({...current, exams: [exam, ...current.exams.filter((item) => item.id !== exam.id)]}))
        return exam
    }, [selectedAcademicYear])

    const fetchExamById = useCallback(async (examId: string) => {
        const exam = await getExamById(examId, selectedAcademicYear)
        setState((current) => ({
            ...current,
            exams: [exam, ...current.exams.filter((item) => item.id !== exam.id)],
        }))
        return exam
    }, [selectedAcademicYear])

    const updateExam = useCallback(async (examId: string, payload: UpdateExamInput) => {
        const exam = await updateExamById(examId, selectedAcademicYear, {
            title: payload.title,
            exam_date: payload.examDate,
            duration_minutes: payload.durationMinutes,
            option_count: payload.optionCount,
            scoring_formula: payload.scoringFormula,
            assigned_student_groups: payload.assignedStudentGroups,
            bubble_sheet_config: payload.bubbleSheetConfig,
            publish_status: payload.publishStatus,
        })
        setState((current) => ({
            ...current,
            exams: current.exams.map((item) => (item.id === exam.id ? exam : item)),
        }))
        return exam
    }, [selectedAcademicYear])

    const setExamQuestions = useCallback(async (examId: string, questions: ExamQuestion[]) => {
        const exam = await updateExamQuestions(examId, selectedAcademicYear, {questions})
        setState((current) => ({
            ...current,
            exams: current.exams.map((item) => (item.id === exam.id ? exam : item)),
        }))
        return exam
    }, [selectedAcademicYear])

    const getCourseById = (courseId: string) => state.courses.find((course) => course.id === courseId)
    const getTeachersByIds = (teacherIds: string[]) => state.teachers.filter((teacher) => teacherIds.includes(teacher.id))
    const getExamsByCourse = (courseId: string) => state.exams.filter((exam) => exam.courseId === courseId)

    const value = useMemo<AcademicContextValue>(
        () => ({
            teachers: state.teachers,
            courses: state.courses,
            exams: state.exams,
            isAcademicYearLoading,
            isTeachersLoading,
            isCoursesLoading,
            isExamsLoading,
            selectedAcademicYear,
            academicYearOptions,
            setSelectedAcademicYear,
            refreshTeachers,
            refreshCourses,
            refreshExams,
            addTeacher,
            addCourse,
            updateCourse,
            deleteCourse,
            fetchCourseById,
            createExam,
            fetchExamById,
            updateExam,
            setExamQuestions,
            getCourseById,
            getTeachersByIds,
            getExamsByCourse,
        }),
        [
            state,
            isAcademicYearLoading,
            isTeachersLoading,
            isCoursesLoading,
            isExamsLoading,
            selectedAcademicYear,
            academicYearOptions,
            setSelectedAcademicYear,
            refreshTeachers,
            refreshCourses,
            refreshExams,
            addCourse,
            updateCourse,
            deleteCourse,
            fetchCourseById,
            createExam,
            fetchExamById,
            updateExam,
            setExamQuestions,
        ],
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

import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react"
import {
    createStudent,
    createStudentGroup,
    deleteStudentById,
    deleteStudentGroupById,
    getStudentGroups,
    getStudentImportJobs,
    getStudents,
    importStudentsCsv,
    updateStudentById,
    updateStudentGroupById,
} from "../api/students"
import {useAcademic} from "../academic/AcademicContext"
import {useAuth} from "../auth/AuthContext"
import type {StudentGroupRecord, StudentImportJobRecord, StudentRecord, StudentStatus} from "../mocks/students"

interface CreateGroupInput {
    academicYear: string
    code: string
    name: string
    advisorName: string
    capacity: number
}

interface UpdateGroupInput {
    code?: string
    name?: string
    advisorName?: string
    capacity?: number
}

interface UpdateStudentInput {
    studentNo?: string
    fullName?: string
    email?: string
    gradeLevel?: string
    status?: StudentStatus
    groupIds?: string[]
}

interface StudentsMockContextValue {
    students: StudentRecord[]
    groups: StudentGroupRecord[]
    importJobs: StudentImportJobRecord[]
    isLoading: boolean
    refresh: () => Promise<void>
    createGroup: (payload: CreateGroupInput) => Promise<StudentGroupRecord>
    updateGroup: (groupId: string, payload: UpdateGroupInput) => Promise<StudentGroupRecord | undefined>
    deleteGroup: (groupId: string) => Promise<void>
    updateStudent: (studentId: string, payload: UpdateStudentInput) => Promise<StudentRecord | undefined>
    deleteStudent: (studentId: string) => Promise<void>
    createImportJob: (payload: {
        fileName: string
        csvContent: string
    }) => Promise<{
        job: StudentImportJobRecord
        totalRows: number
        createdCount: number
        updatedCount: number
        failedCount: number
        errors: string[]
    }>
    createStudentRecord: (payload: {
        studentNo: string
        fullName: string
        email: string
        gradeLevel: string
        status: StudentStatus
        groupIds: string[]
    }) => Promise<StudentRecord>
}

const StudentsMockContext = createContext<StudentsMockContextValue | undefined>(undefined)

export function StudentsMockProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth()
    const {selectedAcademicYear, isAcademicYearLoading} = useAcademic()
    const [students, setStudents] = useState<StudentRecord[]>([])
    const [groups, setGroups] = useState<StudentGroupRecord[]>([])
    const [importJobs, setImportJobs] = useState<StudentImportJobRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const refresh = useCallback(async () => {
        if (!isAuthenticated || !selectedAcademicYear || isAcademicYearLoading) {
            setStudents([])
            setGroups([])
            setImportJobs([])
            return
        }
        setIsLoading(true)
        try {
            const [studentsResult, groupsResult, importJobsResult] = await Promise.all([
                getStudents(selectedAcademicYear),
                getStudentGroups(selectedAcademicYear),
                getStudentImportJobs(selectedAcademicYear),
            ])
            setStudents(studentsResult)
            setGroups(groupsResult)
            setImportJobs(importJobsResult)
        } finally {
            setIsLoading(false)
        }
    }, [isAcademicYearLoading, isAuthenticated, selectedAcademicYear])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const createGroupHandler = useCallback(async (payload: CreateGroupInput) => {
        const created = await createStudentGroup({
            academic_year: payload.academicYear,
            code: payload.code,
            name: payload.name,
            advisor_name: payload.advisorName,
            capacity: payload.capacity,
        })
        setGroups((current) => [created, ...current.filter((item) => item.id !== created.id)])
        return created
    }, [])

    const updateGroupHandler = useCallback(async (groupId: string, payload: UpdateGroupInput) => {
        if (!selectedAcademicYear) return undefined
        const updated = await updateStudentGroupById(groupId, selectedAcademicYear, {
            code: payload.code,
            name: payload.name,
            advisor_name: payload.advisorName,
            capacity: payload.capacity,
        })
        setGroups((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        return updated
    }, [selectedAcademicYear])

    const deleteGroupHandler = useCallback(async (groupId: string) => {
        if (!selectedAcademicYear) return
        await deleteStudentGroupById(groupId, selectedAcademicYear)
        setGroups((current) => current.filter((item) => item.id !== groupId))
        setStudents((current) => current.map((student) => ({
            ...student,
            groupIds: student.groupIds.filter((item) => item !== groupId),
        })))
    }, [selectedAcademicYear])

    const updateStudentHandler = useCallback(async (studentId: string, payload: UpdateStudentInput) => {
        if (!selectedAcademicYear) return undefined
        const updated = await updateStudentById(studentId, selectedAcademicYear, {
            student_no: payload.studentNo,
            full_name: payload.fullName,
            email: payload.email,
            grade_level: payload.gradeLevel,
            status: payload.status,
            group_ids: payload.groupIds,
        })
        setStudents((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        return updated
    }, [selectedAcademicYear])

    const deleteStudentHandler = useCallback(async (studentId: string) => {
        if (!selectedAcademicYear) return
        await deleteStudentById(studentId, selectedAcademicYear)
        setStudents((current) => current.filter((item) => item.id !== studentId))
    }, [selectedAcademicYear])

    const createImportJobHandler = useCallback(async (payload: {
        fileName: string
        csvContent: string
    }) => {
        const result = await importStudentsCsv({
            academic_year: selectedAcademicYear,
            file_name: payload.fileName,
            csv_content: payload.csvContent,
        })
        setImportJobs((current) => [result.job, ...current.filter((item) => item.id !== result.job.id)])
        await refresh()
        return result
    }, [refresh, selectedAcademicYear])

    const createStudentRecord = useCallback(async (payload: {
        studentNo: string
        fullName: string
        email: string
        gradeLevel: string
        status: StudentStatus
        groupIds: string[]
    }) => {
        const created = await createStudent({
            academic_year: selectedAcademicYear,
            student_no: payload.studentNo,
            full_name: payload.fullName,
            email: payload.email,
            grade_level: payload.gradeLevel,
            status: payload.status,
            group_ids: payload.groupIds,
        })
        setStudents((current) => [created, ...current.filter((item) => item.id !== created.id)])
        return created
    }, [selectedAcademicYear])

    const value = useMemo<StudentsMockContextValue>(() => ({
        students,
        groups,
        importJobs,
        isLoading,
        refresh,
        createGroup: createGroupHandler,
        updateGroup: updateGroupHandler,
        deleteGroup: deleteGroupHandler,
        updateStudent: updateStudentHandler,
        deleteStudent: deleteStudentHandler,
        createImportJob: createImportJobHandler,
        createStudentRecord,
    }), [students, groups, importJobs, isLoading, refresh, createGroupHandler, updateGroupHandler, deleteGroupHandler, updateStudentHandler, deleteStudentHandler, createImportJobHandler, createStudentRecord])

    return (
        <StudentsMockContext.Provider value={value}>
            {children}
        </StudentsMockContext.Provider>
    )
}

export function useStudentsMock() {
    const context = useContext(StudentsMockContext)
    if (!context) {
        throw new Error("useStudentsMock must be used within StudentsMockProvider")
    }
    return context
}

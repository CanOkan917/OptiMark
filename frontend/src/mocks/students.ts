export type StudentStatus = "active" | "inactive"
export type ImportStatus = "completed" | "partial" | "failed"

export interface StudentRecord {
    id: string
    academicYear: string
    studentNo: string
    fullName: string
    email: string
    gradeLevel: string
    groupIds: string[]
    status: StudentStatus
    lastImportAt: string
}

export interface StudentGroupRecord {
    id: string
    academicYear: string
    code: string
    name: string
    advisorName: string
    capacity: number
}

export interface StudentImportJobRecord {
    id: string
    academicYear: string
    fileName: string
    createdAt: string
    totalRows: number
    importedRows: number
    failedRows: number
    status: ImportStatus
}

export const mockStudentGroups: StudentGroupRecord[] = [
    {id: "grp-11a", academicYear: "2025-2026", code: "11-A", name: "Grade 11 Science A", advisorName: "Derya Aksoy", capacity: 30},
    {id: "grp-11b", academicYear: "2025-2026", code: "11-B", name: "Grade 11 Science B", advisorName: "Mert Cengiz", capacity: 30},
    {id: "grp-10a", academicYear: "2025-2026", code: "10-A", name: "Grade 10 Core A", advisorName: "Ece Erden", capacity: 32},
    {id: "grp-archive", academicYear: "2024-2025", code: "12-A", name: "Archived Grade 12 A", advisorName: "Naz Yilmaz", capacity: 28},
]

export const mockStudents: StudentRecord[] = [
    {
        id: "std-1001",
        academicYear: "2025-2026",
        studentNo: "20260001",
        fullName: "Ayse Demir",
        email: "ayse.demir@school.edu",
        gradeLevel: "11",
        groupIds: ["grp-11a"],
        status: "active",
        lastImportAt: "2026-03-25T09:35:00Z",
    },
    {
        id: "std-1002",
        academicYear: "2025-2026",
        studentNo: "20260002",
        fullName: "Can Kaya",
        email: "can.kaya@school.edu",
        gradeLevel: "11",
        groupIds: ["grp-11a"],
        status: "active",
        lastImportAt: "2026-03-25T09:35:00Z",
    },
    {
        id: "std-1003",
        academicYear: "2025-2026",
        studentNo: "20260003",
        fullName: "Elif Sahin",
        email: "elif.sahin@school.edu",
        gradeLevel: "11",
        groupIds: ["grp-11b"],
        status: "active",
        lastImportAt: "2026-03-24T13:10:00Z",
    },
    {
        id: "std-1004",
        academicYear: "2025-2026",
        studentNo: "20260004",
        fullName: "Emir Aydin",
        email: "emir.aydin@school.edu",
        gradeLevel: "10",
        groupIds: ["grp-10a"],
        status: "inactive",
        lastImportAt: "2026-03-20T08:00:00Z",
    },
    {
        id: "std-archive-1",
        academicYear: "2024-2025",
        studentNo: "20250010",
        fullName: "Archived Student",
        email: "archived.student@school.edu",
        gradeLevel: "12",
        groupIds: ["grp-archive"],
        status: "inactive",
        lastImportAt: "2025-05-11T10:00:00Z",
    },
]

export const mockStudentImportJobs: StudentImportJobRecord[] = [
    {
        id: "imp-1001",
        academicYear: "2025-2026",
        fileName: "students_11a.csv",
        createdAt: "2026-03-25T09:35:00Z",
        totalRows: 32,
        importedRows: 31,
        failedRows: 1,
        status: "partial",
    },
    {
        id: "imp-1002",
        academicYear: "2025-2026",
        fileName: "students_11b.csv",
        createdAt: "2026-03-24T13:10:00Z",
        totalRows: 29,
        importedRows: 29,
        failedRows: 0,
        status: "completed",
    },
    {
        id: "imp-archive-1",
        academicYear: "2024-2025",
        fileName: "students_12a.csv",
        createdAt: "2025-05-11T10:00:00Z",
        totalRows: 28,
        importedRows: 28,
        failedRows: 0,
        status: "completed",
    },
]

export function formatDateTime(value: string) {
    return new Date(value).toLocaleString()
}

import {apiRequest} from "./client"
import type {ImportStatus, StudentGroupRecord, StudentImportJobRecord, StudentRecord, StudentStatus} from "../mocks/students"

interface ApiStudent {
    id: string
    academic_year: string
    student_no: string
    full_name: string
    email: string
    grade_level: string
    group_ids: string[]
    status: StudentStatus
    created_at: string
    updated_at: string
}

interface ApiStudentsResponse {
    items: ApiStudent[]
}

interface ApiStudentGroup {
    id: string
    academic_year: string
    code: string
    name: string
    advisor_name: string
    capacity: number
    student_count: number
    created_at: string
    updated_at: string
}

interface ApiStudentGroupsResponse {
    items: ApiStudentGroup[]
}

interface ApiStudentImportJob {
    id: string
    academic_year: string
    file_name: string
    created_at: string
    total_rows: number
    imported_rows: number
    failed_rows: number
    status: ImportStatus
}

interface ApiStudentImportJobsResponse {
    items: ApiStudentImportJob[]
}

interface ApiStudentCsvImportResponse {
    job: ApiStudentImportJob
    total_rows: number
    created_count: number
    updated_count: number
    failed_count: number
    errors?: string[]
}

export interface CreateStudentPayload {
    academic_year: string
    student_no: string
    full_name: string
    email: string
    grade_level: string
    status: StudentStatus
    group_ids: string[]
}

export interface UpdateStudentPayload {
    student_no?: string
    full_name?: string
    email?: string
    grade_level?: string
    status?: StudentStatus
    group_ids?: string[]
}

export interface CreateStudentGroupPayload {
    academic_year: string
    code: string
    name: string
    advisor_name: string
    capacity: number
}

export interface UpdateStudentGroupPayload {
    code?: string
    name?: string
    advisor_name?: string
    capacity?: number
}

export interface CreateStudentImportJobPayload {
    academic_year: string
    file_name: string
    total_rows: number
    imported_rows: number
    failed_rows: number
    status: ImportStatus
}

export interface ImportStudentsCsvPayload {
    academic_year: string
    file_name: string
    csv_content: string
}

export interface ImportStudentsCsvResult {
    job: StudentImportJobRecord
    totalRows: number
    createdCount: number
    updatedCount: number
    failedCount: number
    errors: string[]
}

function mapStudent(apiStudent: ApiStudent): StudentRecord {
    return {
        id: apiStudent.id,
        academicYear: apiStudent.academic_year,
        studentNo: apiStudent.student_no,
        fullName: apiStudent.full_name,
        email: apiStudent.email,
        gradeLevel: apiStudent.grade_level,
        groupIds: apiStudent.group_ids,
        status: apiStudent.status,
        lastImportAt: apiStudent.updated_at,
    }
}

function mapStudentGroup(apiGroup: ApiStudentGroup): StudentGroupRecord {
    return {
        id: apiGroup.id,
        academicYear: apiGroup.academic_year,
        code: apiGroup.code,
        name: apiGroup.name,
        advisorName: apiGroup.advisor_name,
        capacity: apiGroup.capacity,
    }
}

function mapImportJob(apiJob: ApiStudentImportJob): StudentImportJobRecord {
    return {
        id: apiJob.id,
        academicYear: apiJob.academic_year,
        fileName: apiJob.file_name,
        createdAt: apiJob.created_at,
        totalRows: apiJob.total_rows,
        importedRows: apiJob.imported_rows,
        failedRows: apiJob.failed_rows,
        status: apiJob.status,
    }
}

export async function getStudents(academicYear: string, search?: string, groupId?: string): Promise<StudentRecord[]> {
    const params = new URLSearchParams({academic_year: academicYear})
    if (search?.trim()) params.set("search", search.trim())
    if (groupId?.trim()) params.set("group_id", groupId.trim())
    const response = await apiRequest<ApiStudentsResponse>(`/students?${params.toString()}`, {
        method: "GET",
        auth: true,
    })
    return response.items.map(mapStudent)
}

export async function getStudentById(studentId: string, academicYear: string): Promise<StudentRecord> {
    const params = new URLSearchParams({academic_year: academicYear})
    const response = await apiRequest<ApiStudent>(`/students/${encodeURIComponent(studentId)}?${params.toString()}`, {
        method: "GET",
        auth: true,
    })
    return mapStudent(response)
}

export async function createStudent(payload: CreateStudentPayload): Promise<StudentRecord> {
    const response = await apiRequest<ApiStudent>("/students", {
        method: "POST",
        auth: true,
        body: payload,
    })
    return mapStudent(response)
}

export async function updateStudentById(studentId: string, academicYear: string, payload: UpdateStudentPayload): Promise<StudentRecord> {
    const params = new URLSearchParams({academic_year: academicYear})
    const response = await apiRequest<ApiStudent>(`/students/${encodeURIComponent(studentId)}?${params.toString()}`, {
        method: "PATCH",
        auth: true,
        body: payload,
    })
    return mapStudent(response)
}

export async function deleteStudentById(studentId: string, academicYear: string): Promise<void> {
    const params = new URLSearchParams({academic_year: academicYear})
    await apiRequest<null>(`/students/${encodeURIComponent(studentId)}?${params.toString()}`, {
        method: "DELETE",
        auth: true,
    })
}

export async function getStudentGroups(academicYear: string, search?: string): Promise<StudentGroupRecord[]> {
    const params = new URLSearchParams({academic_year: academicYear})
    if (search?.trim()) params.set("search", search.trim())
    const response = await apiRequest<ApiStudentGroupsResponse>(`/student-groups?${params.toString()}`, {
        method: "GET",
        auth: true,
    })
    return response.items.map(mapStudentGroup)
}

export async function getStudentGroupById(groupId: string, academicYear: string): Promise<StudentGroupRecord> {
    const params = new URLSearchParams({academic_year: academicYear})
    const response = await apiRequest<ApiStudentGroup>(`/student-groups/${encodeURIComponent(groupId)}?${params.toString()}`, {
        method: "GET",
        auth: true,
    })
    return mapStudentGroup(response)
}

export async function createStudentGroup(payload: CreateStudentGroupPayload): Promise<StudentGroupRecord> {
    const response = await apiRequest<ApiStudentGroup>("/student-groups", {
        method: "POST",
        auth: true,
        body: payload,
    })
    return mapStudentGroup(response)
}

export async function updateStudentGroupById(groupId: string, academicYear: string, payload: UpdateStudentGroupPayload): Promise<StudentGroupRecord> {
    const params = new URLSearchParams({academic_year: academicYear})
    const response = await apiRequest<ApiStudentGroup>(`/student-groups/${encodeURIComponent(groupId)}?${params.toString()}`, {
        method: "PATCH",
        auth: true,
        body: payload,
    })
    return mapStudentGroup(response)
}

export async function deleteStudentGroupById(groupId: string, academicYear: string): Promise<void> {
    const params = new URLSearchParams({academic_year: academicYear})
    await apiRequest<null>(`/student-groups/${encodeURIComponent(groupId)}?${params.toString()}`, {
        method: "DELETE",
        auth: true,
    })
}

export async function getStudentImportJobs(academicYear: string): Promise<StudentImportJobRecord[]> {
    const params = new URLSearchParams({academic_year: academicYear})
    const response = await apiRequest<ApiStudentImportJobsResponse>(`/student-import-jobs?${params.toString()}`, {
        method: "GET",
        auth: true,
    })
    return response.items.map(mapImportJob)
}

export async function createStudentImportJobMock(payload: CreateStudentImportJobPayload): Promise<StudentImportJobRecord> {
    const response = await apiRequest<ApiStudentImportJob>("/student-import-jobs/mock", {
        method: "POST",
        auth: true,
        body: payload,
    })
    return mapImportJob(response)
}

export async function importStudentsCsv(payload: ImportStudentsCsvPayload): Promise<ImportStudentsCsvResult> {
    const response = await apiRequest<ApiStudentCsvImportResponse>("/student-import-jobs/import", {
        method: "POST",
        auth: true,
        body: payload,
    })
    return {
        job: mapImportJob(response.job),
        totalRows: response.total_rows,
        createdCount: response.created_count,
        updatedCount: response.updated_count,
        failedCount: response.failed_count,
        errors: response.errors ?? [],
    }
}

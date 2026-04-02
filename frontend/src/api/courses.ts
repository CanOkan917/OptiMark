import type { Course, Teacher } from "../academic/types"
import { apiRequest } from "./client"

interface TeachersResponse {
  items: Array<{
    id: string
    name: string
    email: string
  }>
}

interface ApiCourse {
  id: string
  academic_year: string
  name: string
  code: string
  description: string
  teacher_ids: string[]
  created_at: string
}

interface CoursesResponse {
  items: ApiCourse[]
}

interface CreateCoursePayload {
  academic_year: string
  name: string
  code: string
  description: string
  teacher_ids: string[]
}

interface UpdateCoursePayload {
  name?: string
  description?: string
  teacher_ids?: string[]
}

function mapCourse(apiCourse: ApiCourse): Course {
  return {
    id: apiCourse.id,
    academicYear: apiCourse.academic_year,
    name: apiCourse.name,
    code: apiCourse.code,
    description: apiCourse.description,
    teacherIds: apiCourse.teacher_ids,
    createdAt: apiCourse.created_at,
  }
}

export async function getTeachers(academicYear: string, search?: string): Promise<Teacher[]> {
  const params = new URLSearchParams({ academic_year: academicYear })
  if (search?.trim()) {
    params.set("search", search.trim())
  }
  const response = await apiRequest<TeachersResponse>(`/teachers?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
  return response.items
}

export async function getCourses(academicYear: string, search?: string): Promise<Course[]> {
  const params = new URLSearchParams({ academic_year: academicYear })
  if (search?.trim()) {
    params.set("search", search.trim())
  }
  const response = await apiRequest<CoursesResponse>(`/courses?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
  return response.items.map(mapCourse)
}

export async function createCourse(payload: CreateCoursePayload): Promise<Course> {
  const response = await apiRequest<ApiCourse>("/courses", {
    method: "POST",
    auth: true,
    body: payload,
  })
  return mapCourse(response)
}

export async function getCourseById(courseId: string, academicYear: string): Promise<Course> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiCourse>(`/courses/${encodeURIComponent(courseId)}?${params.toString()}`, {
    method: "GET",
    auth: true,
  })
  return mapCourse(response)
}

export async function updateCourseById(courseId: string, academicYear: string, payload: UpdateCoursePayload): Promise<Course> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiCourse>(`/courses/${encodeURIComponent(courseId)}?${params.toString()}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  })
  return mapCourse(response)
}

export async function deleteCourseById(courseId: string, academicYear: string): Promise<void> {
  const params = new URLSearchParams({ academic_year: academicYear })
  await apiRequest<null>(`/courses/${encodeURIComponent(courseId)}?${params.toString()}`, {
    method: "DELETE",
    auth: true,
  })
}

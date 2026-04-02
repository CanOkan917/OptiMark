import { apiRequest } from "./client"

interface AcademicYearsResponse {
  items: string[]
}

interface UserPreferencesResponse {
  selected_academic_year: string
}

interface UpdateUserPreferencesPayload {
  selected_academic_year: string
}

export function getAcademicYears() {
  return apiRequest<AcademicYearsResponse>("/academic-years", {
    method: "GET",
    auth: true,
  })
}

export function getMyPreferences() {
  return apiRequest<UserPreferencesResponse>("/users/me/preferences", {
    method: "GET",
    auth: true,
  })
}

export function updateMyPreferences(payload: UpdateUserPreferencesPayload) {
  return apiRequest<UserPreferencesResponse>("/users/me/preferences", {
    method: "PUT",
    auth: true,
    body: payload,
  })
}


export type UserRole = "admin" | "school_admin" | "analyst" | "teacher" | "student"

export interface LoginRequest {
  username_or_email: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  full_name: string
  school_name: string
  password: string
}

export interface AuthTokenResponse {
  access_token: string
  token_type: string
}

export interface User {
  id: number
  email: string
  username: string
  full_name?: string
  school_name?: string
  role: UserRole
  is_active?: boolean
}

export interface DashboardSummary {
  total_users: number
  active_users: number
  admins: number
  school_admins: number
  analysts: number
  teachers: number
  students: number
}

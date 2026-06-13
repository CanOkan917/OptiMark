import type { UserRole } from "../types/auth"
import { apiRequest } from "./client"

export interface StaffMember {
  id: number
  email: string
  username: string
  full_name: string | null
  school_name: string | null
  role: UserRole
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export type StaffRole = "admin" | "school_admin" | "analyst" | "teacher"

export interface CreateStaffPayload {
  email: string
  username: string
  full_name?: string
  school_name?: string
  password: string
  role: StaffRole
}

export interface UpdateStaffPayload {
  full_name?: string
  role?: StaffRole
  is_active?: boolean
}

export async function listStaff(role?: string, search?: string): Promise<StaffMember[]> {
  const params = new URLSearchParams()
  if (role && role !== "all") params.set("role", role)
  if (search?.trim()) params.set("search", search.trim())
  const query = params.toString()
  const response = await apiRequest<{ items: StaffMember[] }>(
    `/staff${query ? `?${query}` : ""}`,
    { method: "GET", auth: true },
  )
  return response.items
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
  return apiRequest<StaffMember>("/staff", { method: "POST", auth: true, body: payload })
}

export async function updateStaff(id: number, payload: UpdateStaffPayload): Promise<StaffMember> {
  return apiRequest<StaffMember>(`/staff/${id}`, { method: "PATCH", auth: true, body: payload })
}

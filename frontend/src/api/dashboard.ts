import type { DashboardSummary } from "../types/auth"
import { apiRequest } from "./client"

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>("/dashboard/summary", {
    method: "GET",
    auth: true,
  })
}

export interface RecentScan {
  id: string
  exam_id: string
  exam_title: string
  original_filename: string
  status: "queued" | "processing" | "completed" | "failed"
  score: number | null
  max_score: number | null
  detected_student_no: string | null
  created_at: string
}

export async function getRecentScans(limit = 8): Promise<RecentScan[]> {
  const response = await apiRequest<{ items: RecentScan[] }>(
    `/dashboard/recent-scans?limit=${limit}`,
    { method: "GET", auth: true },
  )
  return response.items
}

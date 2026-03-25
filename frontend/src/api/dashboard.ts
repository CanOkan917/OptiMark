import type { DashboardSummary } from "../types/auth"
import { apiRequest } from "./client"

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>("/dashboard/summary", {
    method: "GET",
    auth: true,
  })
}

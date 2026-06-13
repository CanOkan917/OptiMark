import { apiFetchBlobUrl, apiRequest, apiUpload } from "./client"

export type ScanStatus = "queued" | "processing" | "completed" | "failed"

export interface ScanJob {
  id: string
  examId: string
  originalFilename: string
  status: ScanStatus
  progress: number
  detectedStudentNo: string | null
  matchedStudentId: string | null
  detectedMarkers: number | null
  score: number | null
  maxScore: number | null
  correctCount: number | null
  wrongCount: number | null
  blankCount: number | null
  ambiguousCount: number | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface ScanJobResult {
  job: ScanJob
  processingMode: string | null
  hasOverlay: boolean
  result: Record<string, unknown>
}

interface ApiScanJob {
  id: string
  exam_id: string
  original_filename: string
  status: ScanStatus
  progress: number
  detected_student_no: string | null
  matched_student_id: string | null
  detected_markers: number | null
  score: number | null
  max_score: number | null
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  ambiguous_count: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

interface ApiScanJobResult {
  job: ApiScanJob
  processing_mode: string | null
  has_overlay: boolean
  result: Record<string, unknown>
}

function mapScanJob(payload: ApiScanJob): ScanJob {
  return {
    id: payload.id,
    examId: payload.exam_id,
    originalFilename: payload.original_filename,
    status: payload.status,
    progress: payload.progress,
    detectedStudentNo: payload.detected_student_no,
    matchedStudentId: payload.matched_student_id,
    detectedMarkers: payload.detected_markers,
    score: payload.score,
    maxScore: payload.max_score,
    correctCount: payload.correct_count,
    wrongCount: payload.wrong_count,
    blankCount: payload.blank_count,
    ambiguousCount: payload.ambiguous_count,
    errorMessage: payload.error_message,
    createdAt: payload.created_at,
    completedAt: payload.completed_at,
  }
}

export async function uploadScan(
  examId: string,
  academicYear: string,
  file: File,
  sheetTemplateId?: string,
): Promise<ScanJob> {
  const formData = new FormData()
  formData.append("academic_year", academicYear)
  formData.append("file", file)
  if (sheetTemplateId) {
    formData.append("sheet_template_id", sheetTemplateId)
  }
  const response = await apiUpload<ApiScanJob>(
    `/exams/${encodeURIComponent(examId)}/scans`,
    formData,
    { auth: true },
  )
  return mapScanJob(response)
}

export async function getScans(examId: string, academicYear: string): Promise<ScanJob[]> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<{ items: ApiScanJob[] }>(
    `/exams/${encodeURIComponent(examId)}/scans?${params.toString()}`,
    { method: "GET", auth: true },
  )
  return response.items.map(mapScanJob)
}

export async function getScan(scanId: string, academicYear: string): Promise<ScanJobResult> {
  const params = new URLSearchParams({ academic_year: academicYear })
  const response = await apiRequest<ApiScanJobResult>(
    `/scans/${encodeURIComponent(scanId)}?${params.toString()}`,
    { method: "GET", auth: true },
  )
  return {
    job: mapScanJob(response.job),
    processingMode: response.processing_mode,
    hasOverlay: response.has_overlay,
    result: response.result,
  }
}

export async function getScanOverlayUrl(scanId: string, academicYear: string): Promise<string> {
  const params = new URLSearchParams({ academic_year: academicYear })
  return apiFetchBlobUrl(`/scans/${encodeURIComponent(scanId)}/overlay?${params.toString()}`)
}

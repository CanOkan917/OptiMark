import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Upload,
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileImage,
    PlayCircle,
    Eye,
    Loader2,
    X,
} from "lucide-react"
import { motion } from "framer-motion"
import { useAcademic } from "../academic/AcademicContext"
import { ApiError } from "../api/client"
import {
    getScan,
    getScans,
    getScanOverlayUrl,
    uploadScan,
    type ScanJob,
    type ScanStatus,
} from "../api/scans"

const TERMINAL: ScanStatus[] = ["completed", "failed"]

function statusBadge(status: ScanStatus) {
    switch (status) {
        case "completed":
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </span>
            )
        case "processing":
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                        <PlayCircle className="h-3.5 w-3.5" />
                    </motion.div>
                    Processing
                </span>
            )
        case "queued":
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> Queued
                </span>
            )
        case "failed":
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                    <AlertCircle className="h-3.5 w-3.5" /> Failed
                </span>
            )
    }
}

export function ScanQueuePage() {
    const { exams, refreshExams, isExamsLoading, selectedAcademicYear } = useAcademic()
    const [selectedExamId, setSelectedExamId] = useState("")
    const [jobs, setJobs] = useState<ScanJob[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [overlay, setOverlay] = useState<{ jobId: string; url: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        void refreshExams()
    }, [refreshExams])

    const loadJobs = useCallback(async () => {
        if (!selectedExamId || !selectedAcademicYear) {
            setJobs([])
            return
        }
        try {
            setJobs(await getScans(selectedExamId, selectedAcademicYear))
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not load scans")
        }
    }, [selectedExamId, selectedAcademicYear])

    useEffect(() => {
        void loadJobs()
    }, [loadJobs])

    // Poll non-terminal jobs until they settle.
    useEffect(() => {
        const pending = jobs.filter((job) => !TERMINAL.includes(job.status))
        if (pending.length === 0 || !selectedAcademicYear) return

        const interval = setInterval(async () => {
            const updates = await Promise.all(
                pending.map((job) =>
                    getScan(job.id, selectedAcademicYear)
                        .then((result) => result.job)
                        .catch(() => job),
                ),
            )
            setJobs((current) =>
                current.map((job) => updates.find((updated) => updated.id === job.id) ?? job),
            )
        }, 2000)

        return () => clearInterval(interval)
    }, [jobs, selectedAcademicYear])

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        if (!selectedExamId) {
            setError("Select an exam before uploading sheets.")
            return
        }
        setError(null)
        setUploading(true)
        try {
            const uploaded: ScanJob[] = []
            for (const file of Array.from(files)) {
                uploaded.push(await uploadScan(selectedExamId, selectedAcademicYear, file))
            }
            setJobs((current) => [...uploaded, ...current])
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const openOverlay = async (jobId: string) => {
        try {
            const url = await getScanOverlayUrl(jobId, selectedAcademicYear)
            setOverlay({ jobId, url })
        } catch {
            setError("Overlay is not available for this scan.")
        }
    }

    const closeOverlay = () => {
        if (overlay) URL.revokeObjectURL(overlay.url)
        setOverlay(null)
    }

    const stats = useMemo(() => {
        const processing = jobs.filter((j) => j.status === "processing" || j.status === "queued").length
        const completed = jobs.filter((j) => j.status === "completed").length
        const failed = jobs.filter((j) => j.status === "failed").length
        return { processing, completed, failed }
    }, [jobs])

    const filteredJobs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return jobs
        return jobs.filter(
            (job) =>
                job.originalFilename.toLowerCase().includes(term) ||
                (job.detectedStudentNo ?? "").toLowerCase().includes(term),
        )
    }, [jobs, searchTerm])

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Scan Queue</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Upload exam sheets and monitor OMR processing & grading.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    >
                        <option value="">{isExamsLoading ? "Loading exams…" : "Select an exam"}</option>
                        {exams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                                {exam.title}
                            </option>
                        ))}
                    </select>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedExamId || uploading}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload Sheets
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    <AlertCircle className="h-4 w-4" /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: "Processing / Queued", value: stats.processing, color: "text-cyan-600", border: "border-cyan-200/60" },
                    { label: "Completed", value: stats.completed, color: "text-emerald-600", border: "border-emerald-200/60" },
                    { label: "Failed", value: stats.failed, color: "text-rose-600", border: "border-rose-200/60" },
                ].map((stat) => (
                    <div key={stat.label} className={`rounded-2xl border ${stat.border} bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]`}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
                        <p className={`mt-2 text-2xl font-black ${stat.color}`}>{stat.value} sheets</p>
                    </div>
                ))}
            </div>

            <section className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by file or student no…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4">Sheet</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Student No</th>
                                <th className="px-6 py-4">Score</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredJobs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-400">
                                        {selectedExamId ? "No sheets uploaded yet." : "Select an exam to view its scans."}
                                    </td>
                                </tr>
                            )}
                            {filteredJobs.map((job) => (
                                <tr key={job.id} className="transition-colors hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                                <FileImage className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="max-w-[220px] truncate font-bold text-slate-900">{job.originalFilename}</p>
                                                <p className="text-xs font-medium text-slate-500">
                                                    {job.detectedMarkers != null ? `${job.detectedMarkers}/4 markers` : job.id}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {statusBadge(job.status)}
                                        {job.status === "failed" && job.errorMessage && (
                                            <p className="mt-1 max-w-[200px] truncate text-xs text-rose-500" title={job.errorMessage}>
                                                {job.errorMessage}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700">
                                        {job.detectedStudentNo || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {job.status === "completed" && job.score != null ? (
                                            <span className="font-bold text-slate-900">
                                                {job.score}
                                                <span className="text-slate-400">/{job.maxScore}</span>
                                                <span className="ml-2 text-xs font-medium text-emerald-600">{job.correctCount}✓</span>
                                                <span className="ml-1 text-xs font-medium text-rose-500">{job.wrongCount}✗</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openOverlay(job.id)}
                                            disabled={job.status !== "completed"}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> Overlay
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {overlay && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6"
                    onClick={closeOverlay}
                >
                    <div className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={closeOverlay}
                            className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <img src={overlay.url} alt="Answer overlay" className="max-h-[85vh] w-auto rounded-lg" />
                    </div>
                </div>
            )}
        </div>
    )
}

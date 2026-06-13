import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
    AlertTriangle,
    ArrowLeft,
    BarChart3,
    Clock,
    Download,
    Eye,
    FileSpreadsheet,
    LayoutDashboard,
    Loader2,
    Plus,
    ScanLine,
    Settings2,
    Upload,
    Users,
    X,
} from "lucide-react"
import { ApiError } from "../api/client"
import {
    generateExamSheet,
    getExamAnalytics,
    getExamOverviewById,
    type ExamAnalytics,
    type ExamOverview,
} from "../api/exams"
import {
    getScan,
    getScans,
    getScanOverlayUrl,
    uploadScan,
    type ScanJob,
    type ScanStatus,
} from "../api/scans"
import { useAcademic } from "../academic/AcademicContext"

type Tab = "dashboard" | "sheets" | "scanning"
const TERMINAL: ScanStatus[] = ["completed", "failed"]

function formatDateTime(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function difficultyColor(rate: number) {
    if (rate >= 70) return "bg-emerald-500"
    if (rate >= 40) return "bg-amber-500"
    return "bg-rose-500"
}

function scanStatusBadge(status: ScanStatus) {
    const map: Record<ScanStatus, string> = {
        completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
        processing: "border-cyan-200 bg-cyan-50 text-cyan-700",
        queued: "border-amber-200 bg-amber-50 text-amber-700",
        failed: "border-rose-200 bg-rose-50 text-rose-700",
    }
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${map[status]}`}>{status}</span>
}

export function ExamOverviewPage() {
    const navigate = useNavigate()
    const { id: examId } = useParams()
    const { selectedAcademicYear } = useAcademic()

    const [tab, setTab] = useState<Tab>("dashboard")
    const [overview, setOverview] = useState<ExamOverview | null>(null)
    const [analytics, setAnalytics] = useState<ExamAnalytics | null>(null)
    const [scans, setScans] = useState<ScanJob[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState("")
    const [overlay, setOverlay] = useState<{ url: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadAll = useCallback(async () => {
        if (!examId) return
        setIsLoading(true)
        try {
            const [ov, an, sc] = await Promise.all([
                getExamOverviewById(examId, selectedAcademicYear),
                getExamAnalytics(examId, selectedAcademicYear).catch(() => null),
                getScans(examId, selectedAcademicYear).catch(() => []),
            ])
            setOverview(ov)
            setAnalytics(an)
            setScans(sc)
            setError(null)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Exam could not be loaded."))
        } finally {
            setIsLoading(false)
        }
    }, [examId, selectedAcademicYear])

    useEffect(() => { void loadAll() }, [loadAll])

    // Poll in-progress scans.
    useEffect(() => {
        const pending = scans.filter((s) => !TERMINAL.includes(s.status))
        if (pending.length === 0 || !examId) return
        const interval = setInterval(async () => {
            const updated = await Promise.all(
                pending.map((s) => getScan(s.id, selectedAcademicYear).then((r) => r.job).catch(() => s)),
            )
            setScans((cur) => cur.map((s) => updated.find((u) => u.id === s.id) ?? s))
        }, 2000)
        return () => clearInterval(interval)
    }, [scans, examId, selectedAcademicYear])

    const handleGenerateSheet = async () => {
        if (!examId) return
        setIsGeneratingSheet(true)
        setError(null)
        const tab = window.open("about:blank", "_blank")
        try {
            const response = await generateExamSheet(examId, selectedAcademicYear)
            if (tab && !tab.closed) tab.location.href = response.downloadUrl
            await loadAll()
        } catch (err) {
            if (tab && !tab.closed) tab.close()
            setError(err instanceof ApiError ? err.message : "Sheet generation failed.")
        } finally {
            setIsGeneratingSheet(false)
        }
    }

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0 || !examId) return
        setUploading(true)
        setError(null)
        try {
            const uploaded: ScanJob[] = []
            for (const file of Array.from(files)) {
                uploaded.push(await uploadScan(examId, selectedAcademicYear, file, selectedTemplate || undefined))
            }
            setScans((cur) => [...uploaded, ...cur])
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Upload failed.")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const openOverlay = async (scanId: string) => {
        try {
            setOverlay({ url: await getScanOverlayUrl(scanId, selectedAcademicYear) })
        } catch {
            setError("Overlay not available for this scan.")
        }
    }
    const closeOverlay = () => {
        if (overlay) URL.revokeObjectURL(overlay.url)
        setOverlay(null)
    }

    const sheetTemplates = overview?.sheetTemplates ?? []
    useEffect(() => {
        if (!selectedTemplate && sheetTemplates.length > 0) setSelectedTemplate(sheetTemplates[0].id)
    }, [sheetTemplates, selectedTemplate])

    const maxBucket = useMemo(
        () => Math.max(1, ...(analytics?.scoreDistribution.map((b) => b.count) ?? [1])),
        [analytics],
    )

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-10 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />
                    <p className="text-sm font-semibold text-slate-600">Loading exam...</p>
                </div>
            </div>
        )
    }

    if (!overview) {
        return (
            <div className="mx-auto max-w-4xl">
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
                    <AlertTriangle className="mb-3 h-8 w-8 text-rose-500" />
                    <h1 className="text-xl font-black text-rose-900">Exam unavailable</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">{error ?? "Unknown error."}</p>
                    <button onClick={() => navigate("/dashboard/exams")} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700">
                        <ArrowLeft className="h-4 w-4" /> Back to Exams
                    </button>
                </div>
            </div>
        )
    }

    const { exam } = overview
    const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "sheets", label: "Sheets", icon: FileSpreadsheet },
        { id: "scanning", label: "Scanning", icon: ScanLine },
    ]

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <button onClick={() => navigate("/dashboard/exams")} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="h-4 w-4" /> Back to Exams
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-slate-950">{exam.title}</h1>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${exam.publishStatus === "published" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {exam.publishStatus}
                        </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">Exam dashboard, analytics, sheets and scanning.</p>
                </div>
                <button onClick={() => navigate(`/dashboard/exams/${exam.id}/publish`)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <Settings2 className="h-4 w-4" /> Publish Settings
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
            )}

            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                {tabs.map((t) => {
                    const Icon = t.icon
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${tab === t.id ? "bg-cyan-500 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}>
                            <Icon className="h-4 w-4" /> {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === "dashboard" && <DashboardTab overview={overview} analytics={analytics} maxBucket={maxBucket} />}

            {tab === "sheets" && (
                <section className="rounded-3xl border border-slate-200/60 bg-white p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Generated Sheets</h2>
                            <p className="text-xs font-medium text-slate-500">{sheetTemplates.length} templates</p>
                        </div>
                        <button onClick={() => void handleGenerateSheet()} disabled={isGeneratingSheet} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-70">
                            {isGeneratingSheet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {isGeneratingSheet ? "Generating..." : "Generate New Sheet"}
                        </button>
                    </div>
                    {sheetTemplates.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-700">No sheets generated yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sheetTemplates.map((sheet) => (
                                <div key={sheet.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-mono text-sm font-bold text-slate-900">{sheet.id}</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500"><Users className="mr-1 inline h-3.5 w-3.5" /> {sheet.questionCount} questions · {sheet.optionCount} options</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500"><Clock className="mr-1 inline h-3.5 w-3.5" /> {formatDateTime(sheet.createdAt)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setSelectedTemplate(sheet.id); setTab("scanning") }} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-50">
                                            <ScanLine className="h-4 w-4" /> Scan with this
                                        </button>
                                        <a href={sheet.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                                            <Download className="h-4 w-4" /> PDF
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {tab === "scanning" && (
                <section className="space-y-5">
                    <div className="rounded-3xl border border-slate-200/60 bg-white p-6">
                        <h2 className="text-lg font-black text-slate-900">Scan Answer Sheets</h2>
                        <p className="mb-4 text-xs font-medium text-slate-500">Select a sheet template, then upload photographed/scanned sheets to grade them.</p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Sheet Template</label>
                                <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500">
                                    {sheetTemplates.length === 0 && <option value="">No sheets — generate one first</option>}
                                    {sheetTemplates.map((s) => (
                                        <option key={s.id} value={s.id}>{s.id} · {s.questionCount}q/{s.optionCount}opt · {formatDateTime(s.createdAt)}</option>
                                    ))}
                                </select>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || sheetTemplates.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Sheets
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                            <h3 className="text-sm font-black text-slate-900">Scans for this exam ({scans.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-3">Sheet</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Student No</th>
                                        <th className="px-6 py-3">Score</th>
                                        <th className="px-6 py-3 text-right">Overlay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {scans.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-sm font-medium text-slate-400">No scans yet.</td></tr>
                                    )}
                                    {scans.map((scan) => (
                                        <tr key={scan.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3"><p className="max-w-[200px] truncate font-semibold text-slate-800">{scan.originalFilename}</p></td>
                                            <td className="px-6 py-3">{scanStatusBadge(scan.status)}</td>
                                            <td className="px-6 py-3 font-mono">{scan.detectedStudentNo || "—"}</td>
                                            <td className="px-6 py-3">{scan.status === "completed" && scan.score != null ? <span className="font-bold text-slate-900">{scan.score}/{scan.maxScore}</span> : "—"}</td>
                                            <td className="px-6 py-3 text-right">
                                                <button onClick={() => openOverlay(scan.id)} disabled={scan.status !== "completed"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                                                    <Eye className="h-3.5 w-3.5" /> View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {overlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6" onClick={closeOverlay}>
                    <div className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={closeOverlay} className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"><X className="h-4 w-4" /></button>
                        <img src={overlay.url} alt="Answer overlay" className="max-h-[85vh] w-auto rounded-lg" />
                    </div>
                </div>
            )}
        </div>
    )
}

function DashboardTab({ overview, analytics, maxBucket }: { overview: ExamOverview; analytics: ExamAnalytics | null; maxBucket: number }) {
    const { metrics } = overview
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard label="Participation" value={`${metrics.participationRate}%`} sub={`${metrics.submittedAnswerCount} / ${metrics.assignedStudentCount} students`} />
                <StatCard label="Submitted" value={String(metrics.submittedAnswerCount)} sub={`${metrics.absentCount} absent`} />
                <StatCard label="Average Score" value={metrics.averageScore === null ? "—" : metrics.averageScore.toFixed(2)} sub={`${metrics.gradedSubmissionCount} graded · ${metrics.pendingGradingCount} pending`} />
            </div>

            {!analytics || analytics.completedScans === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No graded scans yet.</p>
                    <p className="mt-1 text-xs text-slate-500">Analytics appear once you scan and grade answer sheets.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                        <StatCard label="Graded" value={String(analytics.completedScans)} sub={`${analytics.matchedStudents} matched`} small />
                        <StatCard label="Average" value={analytics.averageScore?.toFixed(1) ?? "—"} sub={`max ${analytics.maxScore ?? "—"}`} small />
                        <StatCard label="Median" value={analytics.medianScore?.toFixed(1) ?? "—"} small />
                        <StatCard label="Highest" value={analytics.highestScore != null ? String(analytics.highestScore) : "—"} small />
                        <StatCard label="Pass Rate" value={analytics.passRate != null ? `${analytics.passRate}%` : "—"} sub="≥ 50% of max" small />
                    </div>

                    <section className="rounded-3xl border border-slate-200/60 bg-white p-6">
                        <h3 className="mb-4 text-sm font-black text-slate-900">Score Distribution</h3>
                        <div className="space-y-2.5">
                            {analytics.scoreDistribution.map((b) => (
                                <div key={b.label} className="flex items-center gap-3">
                                    <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{b.label}</span>
                                    <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                                        <div className="flex h-full items-center justify-end rounded-lg bg-cyan-500 px-2 text-[10px] font-bold text-white transition-all" style={{ width: `${(b.count / maxBucket) * 100}%` }}>
                                            {b.count > 0 ? b.count : ""}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                            <h3 className="text-sm font-black text-slate-900">Question Analysis</h3>
                            <p className="text-xs font-medium text-slate-500">Correct-answer rate per question (low rate = harder / problematic)</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-3">Q#</th>
                                        <th className="px-6 py-3">Answer</th>
                                        <th className="px-6 py-3 w-1/2">Correct Rate</th>
                                        <th className="px-6 py-3 text-center">✓ / ✗ / blank</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {analytics.questionStats.map((q) => (
                                        <tr key={q.questionNo} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-bold text-slate-900">{q.questionNo}</td>
                                            <td className="px-6 py-3 font-mono font-bold text-slate-700">{q.correctOption ?? "—"}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                                        <div className={`h-full rounded-full ${difficultyColor(q.correctRate)}`} style={{ width: `${q.correctRate}%` }} />
                                                    </div>
                                                    <span className="w-12 text-right text-xs font-bold text-slate-700">{q.correctRate}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center text-xs font-semibold">
                                                <span className="text-emerald-600">{q.correct}</span> / <span className="text-rose-500">{q.wrong}</span> / <span className="text-slate-400">{q.blank}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    )
}

function StatCard({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-2 font-black text-slate-900 ${small ? "text-2xl" : "text-3xl"}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
    )
}

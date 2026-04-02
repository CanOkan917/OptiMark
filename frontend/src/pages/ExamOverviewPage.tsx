import {useCallback, useEffect, useState} from "react"
import {useNavigate, useParams} from "react-router-dom"
import {AlertTriangle, ArrowLeft, Clock, Download, FileSpreadsheet, Plus, Settings2, Users} from "lucide-react"
import {ApiError} from "../api/client"
import {generateExamSheet, getExamOverviewById, type ExamOverview} from "../api/exams"
import {useAcademic} from "../academic/AcademicContext"

function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}

export function ExamOverviewPage() {
    const navigate = useNavigate()
    const {id: examId} = useParams()
    const {selectedAcademicYear} = useAcademic()

    const [overview, setOverview] = useState<ExamOverview | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadOverview = useCallback(async () => {
        if (!examId) return
        setIsLoading(true)
        try {
            const payload = await getExamOverviewById(examId, selectedAcademicYear)
            setOverview(payload)
            setError(null)
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : (err instanceof Error ? err.message : "Exam overview could not be loaded.")
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [examId, selectedAcademicYear])

    useEffect(() => {
        void loadOverview()
    }, [loadOverview])

    const handleGenerateSheet = async () => {
        if (!examId) return
        setIsGeneratingSheet(true)
        setError(null)
        const downloadTab = window.open("about:blank", "_blank")
        try {
            const response = await generateExamSheet(examId, selectedAcademicYear)
            if (downloadTab && !downloadTab.closed) {
                downloadTab.location.href = response.downloadUrl
            } else {
                window.open(response.downloadUrl, "_blank")
            }
            await loadOverview()
        } catch (err) {
            if (downloadTab && !downloadTab.closed) {
                downloadTab.close()
            }
            const message = err instanceof ApiError
                ? err.message
                : (err instanceof Error ? err.message : "Sheet generation failed.")
            setError(message)
        } finally {
            setIsGeneratingSheet(false)
        }
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-10 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600"/>
                    <p className="text-sm font-semibold text-slate-600">Loading exam overview...</p>
                </div>
            </div>
        )
    }

    if (!overview || error) {
        return (
            <div className="mx-auto max-w-4xl">
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
                    <AlertTriangle className="mb-3 h-8 w-8 text-rose-500"/>
                    <h1 className="text-xl font-black text-rose-900">Exam overview unavailable</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">{error ?? "Unknown error."}</p>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/exams")}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Exams
                    </button>
                </div>
            </div>
        )
    }

    const {exam, metrics, sheetTemplates} = overview

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/exams")}
                        className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Exams
                    </button>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">{exam.title}</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Published exam overview, sheets and submission metrics.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/dashboard/exams/${exam.id}/publish`)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        <Settings2 className="h-4 w-4"/> Publish Settings
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleGenerateSheet()}
                        disabled={isGeneratingSheet}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
                    >
                        {isGeneratingSheet ? <Settings2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}
                        {isGeneratingSheet ? "Generating..." : "Generate New Sheet"}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {error}
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Participation</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{metrics.participationRate}%</p>
                    <p className="mt-1 text-xs text-slate-500">{metrics.submittedAnswerCount} / {metrics.assignedStudentCount} students</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Submitted Answers</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{metrics.submittedAnswerCount}</p>
                    <p className="mt-1 text-xs text-slate-500">{metrics.absentCount} absent</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Average Score</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                        {metrics.averageScore === null ? "-" : metrics.averageScore.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{metrics.gradedSubmissionCount} graded, {metrics.pendingGradingCount} pending</p>
                </div>
            </div>

            <section className="rounded-3xl border border-slate-200/60 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Generated Sheets</h2>
                    <span className="text-xs font-semibold text-slate-500">{sheetTemplates.length} templates</span>
                </div>

                {sheetTemplates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300"/>
                        <p className="text-sm font-semibold text-slate-700">No sheets generated yet.</p>
                        <p className="mt-1 text-xs text-slate-500">Use "Generate New Sheet" to create and download a template PDF.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sheetTemplates.map((sheet) => (
                            <div
                                key={sheet.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <p className="text-sm font-bold text-slate-900">{sheet.id}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        <Users className="mr-1 inline h-3.5 w-3.5"/> {sheet.questionCount} questions, {sheet.optionCount} options
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        <Clock className="mr-1 inline h-3.5 w-3.5"/> {formatDateTime(sheet.createdAt)}
                                    </p>
                                </div>
                                <a
                                    href={sheet.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-50"
                                >
                                    <Download className="h-4 w-4"/> Download PDF
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

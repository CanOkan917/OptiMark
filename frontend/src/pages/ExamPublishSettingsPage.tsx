import React, {useEffect, useMemo, useState} from "react"
import {useNavigate, useParams} from "react-router-dom"
import {
    ArrowLeft,
    CheckCircle2,
    Send,
    Settings2,
    Users,
    FileSpreadsheet,
    Calendar,
    Clock,
    AlignLeft,
    FileText,
    AlertTriangle,
    X
} from "lucide-react"
import {ApiError} from "../api/client"
import {useAcademic} from "../academic/AcademicContext"
import type {ScoringFormula} from "../academic/types"

const defaultBubbleConfig = {
    template_style: "standard",
    include_student_name: true,
    include_student_id: true,
    include_booklet_code: true,
    include_barcode: true,
    shuffle_question_order: false,
    show_instructions: true,
    booklet_code_label: "Booklet",
}

const presetGroups = [
    "Group A",
    "Group B",
    "Group C",
    "Morning Session",
    "Afternoon Session",
    "Retake Students",
]

export function ExamPublishSettingsPage() {
    const navigate = useNavigate()
    const {id: examId} = useParams()
    const {fetchExamById, updateExam} = useAcademic()

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [title, setTitle] = useState("")
    const [examDate, setExamDate] = useState("")
    const [durationMinutes, setDurationMinutes] = useState(60)
    const [scoringFormula, setScoringFormula] = useState<ScoringFormula>("standard")
    const [assignedGroups, setAssignedGroups] = useState<string[]>([])
    const [newGroupInput, setNewGroupInput] = useState("")
    const [bubbleConfig, setBubbleConfig] = useState<Record<string, string | number | boolean>>(defaultBubbleConfig)

    const availableGroups = useMemo(() => {
        const merged = [...presetGroups, ...assignedGroups]
        return Array.from(new Set(merged))
    }, [assignedGroups])

    useEffect(() => {
        let cancelled = false

        const run = async () => {
            if (!examId) {
                setError("Exam ID is missing in route.")
                setIsLoading(false)
                return
            }

            setIsLoading(true)
            try {
                const exam = await fetchExamById(examId)
                if (!exam || cancelled) return

                setTitle(exam.title)
                setExamDate(exam.examDate)
                setDurationMinutes(exam.durationMinutes)
                setScoringFormula(exam.scoringFormula)
                setAssignedGroups(exam.assignedStudentGroups ?? [])
                setBubbleConfig({...defaultBubbleConfig, ...(exam.bubbleSheetConfig ?? {})})
                setError(null)
            } catch (err) {
                if (cancelled) return
                const message = err instanceof ApiError
                    ? err.message
                    : (err instanceof Error ? err.message : "Could not load exam settings.")
                setError(message)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void run()
        return () => {
            cancelled = true
        }
    }, [examId, fetchExamById])

    const toggleGroup = (group: string) => {
        setAssignedGroups((current) =>
            current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
        )
    }

    const addCustomGroup = () => {
        const value = newGroupInput.trim()
        if (!value) return
        if (!assignedGroups.includes(value)) {
            setAssignedGroups((current) => [...current, value])
        }
        setNewGroupInput("")
    }

    const handleCustomGroupKeydown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addCustomGroup()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!examId) return

        if (!title.trim()) {
            setError("Exam title is required.")
            return
        }
        if (!examDate) {
            setError("Exam date is required.")
            return
        }
        if (assignedGroups.length === 0) {
            setError("Assign at least one student group before publishing.")
            return
        }

        setIsSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            await updateExam(examId, {
                title: title.trim(),
                examDate,
                durationMinutes,
                scoringFormula,
                assignedStudentGroups: assignedGroups,
                bubbleSheetConfig: bubbleConfig,
                publishStatus: "published",
            })
            setSuccess("Exam successfully published. You can now generate bubble sheets or start scanning.")
            setTimeout(() => {
                navigate("/dashboard/exams")
            }, 2500)
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : (err instanceof Error ? err.message : "Could not save exam settings.")
            setError(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl mt-10">
                <div
                    className="rounded-3xl border border-slate-200/60 bg-white p-10 shadow-[0_8px_30px_rgba(15,23,42,0.04)] text-center">
                    <div
                        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600 mb-4"></div>
                    <p className="text-sm font-semibold text-slate-600">Loading publish settings...</p>
                </div>
            </div>
        )
    }

    if (error && !title) {
        return (
            <div className="mx-auto max-w-4xl mt-10">
                <div className="rounded-3xl border border-rose-200/60 bg-rose-50 p-8 shadow-sm text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-4"/>
                    <h1 className="text-xl font-black text-rose-900">Unable to load settings</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/exams")}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 border border-rose-200 cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Exams
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-12">

            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate(`/dashboard/exams/${examId}/builder`)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                    <ArrowLeft className="h-4 w-4"/> Back to Builder
                </button>
            </div>

            <section
                className="overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                {/* Section Title */}
                <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 shadow-inner">
                            <Send className="h-5 w-5"/>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">Publish & Finalize
                                Exam</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">Review meta details and configure
                                bubble sheet generation.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">

                    {/* Error / Success Alerts */}
                    {error && (
                        <div
                            className="flex items-center justify-between rounded-xl bg-rose-50 px-5 py-3 border border-rose-100">
                            <span className="flex items-center gap-2 text-sm font-bold text-rose-800">
                                <AlertTriangle className="h-4 w-4"/> {error}
                            </span>
                            <button type="button" onClick={() => setError(null)}
                                    className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4"/></button>
                        </div>
                    )}
                    {success && (
                        <div
                            className="flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-4 border border-emerald-100 text-sm font-bold text-emerald-800">
                            <CheckCircle2 className="h-5 w-5"/> {success}
                        </div>
                    )}

                    {/* GENERAL SETTINGS */}
                    <div>
                        <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                            <Settings2 className="h-4 w-4"/> General Meta
                        </h2>

                        <div className="grid gap-6 rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                                    <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5"/> Exam Title</span>
                                </label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Midterm: Calculus I"
                                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label
                                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5"/> Examination Date</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={examDate}
                                        onChange={(e) => setExamDate(e.target.value)}
                                        className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                                        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> Duration (Minutes)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={15}
                                        value={durationMinutes}
                                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                        className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label
                                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Scoring
                                        Rules</label>
                                    <select
                                        value={scoringFormula}
                                        onChange={(e) => setScoringFormula(e.target.value as ScoringFormula)}
                                        className="h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    >
                                        <option value="standard">Standard (No Penalty)</option>
                                        <option value="penalty">Penalty (4 Wrongs = 1 Right)</option>
                                    </select>
                                </div>
                                <div/>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100"/>

                    {/* ASSIGNMENTS */}
                    <div>
                        <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                            <Users className="h-4 w-4"/> Audience & Groups
                        </h2>

                        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                            <p className="mb-4 text-sm font-medium text-slate-500">Select the student groups that will
                                take this exam.</p>

                            <div className="flex flex-wrap gap-2.5">
                                {availableGroups.map((group) => {
                                    const active = assignedGroups.includes(group)
                                    return (
                                        <button
                                            key={group}
                                            type="button"
                                            onClick={() => toggleGroup(group)}
                                            className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                                                active
                                                    ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                            }`}
                                        >
                                            {group}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="mt-5 flex gap-3 border-t border-slate-100 pt-5">
                                <input
                                    value={newGroupInput}
                                    onChange={(e) => setNewGroupInput(e.target.value)}
                                    onKeyDown={handleCustomGroupKeydown}
                                    placeholder="Type a custom group name..."
                                    className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                                <button
                                    type="button"
                                    onClick={addCustomGroup}
                                    className="cursor-pointer rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                                >
                                    Add Group
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100"/>

                    {/* BUBBLE SHEET CONFIG */}
                    <div>
                        <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                            <FileSpreadsheet className="h-4 w-4"/> Bubble Sheet Appearance
                        </h2>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label
                                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                                        <span className="flex items-center gap-1.5"><AlignLeft className="h-3.5 w-3.5"/> Template Layout</span>
                                    </label>
                                    <select
                                        value={String(bubbleConfig.template_style ?? "standard")}
                                        onChange={(e) => setBubbleConfig((current) => ({
                                            ...current,
                                            template_style: e.target.value
                                        }))}
                                        className="h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    >
                                        <option value="standard">Standard (A4)</option>
                                        <option value="compact">Compact (Half Page)</option>
                                        <option value="extended">Extended (Max Questions)</option>
                                    </select>
                                </div>

                                <div>
                                    <label
                                        className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Booklet
                                        Code Label</label>
                                    <input
                                        value={String(bubbleConfig.booklet_code_label ?? "Booklet")}
                                        onChange={(e) => setBubbleConfig((current) => ({
                                            ...current,
                                            booklet_code_label: e.target.value
                                        }))}
                                        placeholder="e.g. Form, Group, Booklet"
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>

                            <div className="mt-8">
                                <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-600">Included
                                    Elements</p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        {key: "include_student_name", label: "Student Name Field"},
                                        {key: "include_student_id", label: "Student ID Grid"},
                                        {key: "include_booklet_code", label: "Booklet Code Grid"},
                                        {key: "include_barcode", label: "Generate Barcode"},
                                        {key: "shuffle_question_order", label: "Shuffle Questions"},
                                        {key: "show_instructions", label: "Filling Instructions"},
                                    ].map(({key, label}) => (
                                        <label
                                            key={key}
                                            className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-cyan-300 hover:bg-cyan-50/50"
                                        >
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(bubbleConfig[key])}
                                                    onChange={(e) => setBubbleConfig((current) => ({
                                                        ...current,
                                                        [key]: e.target.checked
                                                    }))}
                                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-colors checked:border-cyan-500 checked:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-1"
                                                />
                                                <CheckCircle2
                                                    className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                                                    strokeWidth={3}/>
                                            </div>
                                            <span
                                                className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-8">
                        <button
                            type="button"
                            onClick={() => navigate(`/dashboard/exams/${examId}/builder`)}
                            className="cursor-pointer rounded-xl px-6 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !!success}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-700 hover:shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95 disabled:pointer-events-none disabled:opacity-70"
                        >
                            {isSubmitting ? (
                                <div
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                            ) : (
                                <Send className="h-4 w-4"/>
                            )}
                            {isSubmitting ? "Publishing..." : "Publish Exam"}
                        </button>
                    </div>

                </form>
            </section>
        </div>
    )
}

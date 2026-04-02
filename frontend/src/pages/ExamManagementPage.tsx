import {useEffect, useMemo, useState} from "react"
import {useSearchParams, useNavigate} from "react-router-dom"
import {useAcademic} from "../academic/AcademicContext"
import {
    Search,
    Plus,
    Calendar,
    Clock,
    FileText,
    Settings2,
    ChevronRight,
    Printer,
    ScanLine,
    X,
    Check,
    AlertTriangle
} from "lucide-react"
import {motion, AnimatePresence} from "framer-motion"
import {ApiError} from "../api/client"
import {generateExamSheet} from "../api/exams"

export function ExamManagementPage() {
    const navigate = useNavigate()
    const {courses, createExam, exams, refreshCourses, refreshExams, selectedAcademicYear} = useAcademic()

    const [searchParams, setSearchParams] = useSearchParams()
    const initialCourseId = searchParams.get("courseId") ?? "all"

    // UI States
    const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId)
    const [searchTerm, setSearchTerm] = useState("")
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    // New Exam Form States
    const [newExamCourseId, setNewExamCourseId] = useState("")
    const [title, setTitle] = useState("")
    const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10))
    const [durationMinutes, setDurationMinutes] = useState(60)
    const [optionCount, setOptionCount] = useState<4 | 5>(4)
    const [scoringFormula, setScoringFormula] = useState<"standard" | "penalty">("standard")

    // Feedback
    const [createError, setCreateError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [generatingExamId, setGeneratingExamId] = useState<string | null>(null)

    const displayExams = useMemo(
        () => [...exams].sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime()),
        [exams],
    )

    useEffect(() => {
        void refreshCourses()
    }, [refreshCourses])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshExams(selectedCourseId, searchTerm)
        }, 250)
        return () => window.clearTimeout(timer)
    }, [refreshExams, searchTerm, selectedCourseId])

    const openCreateModal = () => {
        setNewExamCourseId(selectedCourseId !== "all" ? selectedCourseId : "")
        setCreateError(null)
        setIsCreateModalOpen(true)
    }

    const handleCreateExam = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError(null)

        if (!newExamCourseId) {
            setCreateError("Please select a course for this exam.")
            return
        }
        if (!title.trim()) {
            setCreateError("Exam title is required.")
            return
        }

        try {
            await createExam({
                courseId: newExamCourseId,
                title: title.trim(),
                examDate,
                durationMinutes,
                optionCount,
                scoringFormula,
                questions: [],
            })

            setSuccess(`"${title}" drafted successfully.`)
            setIsCreateModalOpen(false)

            setTitle("")
            setDurationMinutes(60)
            setOptionCount(4)
            setScoringFormula("standard")
            setCreateError(null)

            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            if (err instanceof ApiError) {
                setCreateError(err.message)
                return
            }
            setCreateError("Exam could not be created.")
        }
    }

    const handleGenerateSheet = async (examId: string, examTitle: string) => {
        setActionError(null)
        setSuccess(null)
        setGeneratingExamId(examId)

        const downloadTab = window.open("about:blank", "_blank")

        try {
            const generated = await generateExamSheet(examId, selectedAcademicYear)

            if (downloadTab && !downloadTab.closed) {
                downloadTab.location.href = generated.downloadUrl
            } else {
                window.open(generated.downloadUrl, "_blank")
            }

            setSuccess(`"${examTitle}" sheet generated. Download started.`)
            setTimeout(() => setSuccess(null), 5000)
            await refreshExams(selectedCourseId, searchTerm)
        } catch (err) {
            if (downloadTab && !downloadTab.closed) {
                downloadTab.close()
            }

            if (err instanceof ApiError) {
                setActionError(err.message)
                return
            }
            setActionError("Sheet could not be generated.")
        } finally {
            setGeneratingExamId((current) => (current === examId ? null : current))
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">

            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Exams & Assessments</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Create exams, configure grading rubrics, and print optical mark forms.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-700 active:scale-95"
                >
                    <Plus className="h-4 w-4"/>
                    Draft New Exam
                </button>
            </div>

            <div
                className="flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center">
                <div className="flex-shrink-0">
                    <select
                        value={selectedCourseId}
                        onChange={(e) => {
                            setSelectedCourseId(e.target.value)
                            setSearchParams(e.target.value !== "all" ? {courseId: e.target.value} : {})
                        }}
                        className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    >
                        <option value="all">All Courses</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </select>
                </div>

                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                    <input
                        type="text"
                        placeholder="Search by exam title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>
            </div>

            <AnimatePresence>
                {success && (
                    <motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, height: 0}}
                                className="rounded-xl bg-emerald-50 px-4 py-3 border border-emerald-100 flex items-center gap-2 text-sm font-bold text-emerald-700">
                        <Check className="h-4 w-4"/> {success}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {actionError && (
                    <motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, height: 0}}
                                className="rounded-xl bg-rose-50 px-4 py-3 border border-rose-100 flex items-center justify-between gap-2 text-sm font-bold text-rose-700">
                        <span className="inline-flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4"/> {actionError}
                        </span>
                        <button
                            type="button"
                            onClick={() => setActionError(null)}
                            className="rounded-md p-1 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-700"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {displayExams.length === 0 ? (
                    <div
                        className="col-span-full py-12 text-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50">
                        <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3"/>
                        <h3 className="text-sm font-bold text-slate-900">No exams found</h3>
                        <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new draft.</p>
                    </div>
                ) : (
                    displayExams.map((exam) => {
                        const course = courses.find(c => c.id === exam.courseId)
                        const isDraft = exam.questions.length === 0
                        const isPublished = exam.publishStatus === "published"
                        const isGeneratingThisExam = generatingExamId === exam.id

                        return (
                            <motion.div
                                layout
                                initial={{opacity: 0, scale: 0.95}}
                                animate={{opacity: 1, scale: 1}}
                                key={exam.id}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:border-cyan-200/60"
                            >
                                <div className="p-5 flex-1">
                                    <div className="mb-3 flex items-start justify-between">
                                        <span
                                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                            {course?.code || "Unknown Course"}
                                        </span>
                                        {isDraft && (
                                            <span
                                                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                Draft
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 leading-tight mb-4">{exam.title}</h3>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Calendar className="h-4 w-4 text-slate-400"/>
                                            <span className="font-medium">{exam.examDate}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Clock className="h-4 w-4 text-slate-400"/>
                                            <span className="font-medium">{exam.durationMinutes} mins</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Settings2 className="h-4 w-4 text-slate-400"/>
                                            <span
                                                className="font-medium">{exam.optionCount} Options ({exam.questions.length} Qs)</span>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="border-t border-slate-100 bg-slate-50/50 p-3 flex items-center justify-between">
                                    <div className="flex gap-1">
                                        <button
                                            title="Print Bubble Sheets"
                                            onClick={() => void handleGenerateSheet(exam.id, exam.title)}
                                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-cyan-600 hover:shadow-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            disabled={isDraft || generatingExamId !== null}
                                        >
                                            {isGeneratingThisExam ? (
                                                <Settings2 className="h-4 w-4 animate-spin"/>
                                            ) : (
                                                <Printer className="h-4 w-4"/>
                                            )}
                                        </button>
                                        <button
                                            title="Scan Papers"
                                            onClick={() => navigate(`/dashboard/scans?examId=${exam.id}`)}
                                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-cyan-600 hover:shadow-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            disabled={isDraft}
                                        >
                                            <ScanLine className="h-4 w-4"/>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => navigate(isPublished ? `/dashboard/exams/${exam.id}` : `/dashboard/exams/${exam.id}/builder`)}
                                        className="inline-flex items-center gap-1 text-sm font-bold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                                    >
                                        {isPublished ? "Open Overview" : "Open Editor"}
                                        <ChevronRight className="h-4 w-4"/>
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>

            <AnimatePresence>
                {isCreateModalOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                        <motion.div
                            initial={{opacity: 0, scale: 0.95, y: 20}}
                            animate={{opacity: 1, scale: 1, y: 0}}
                            exit={{opacity: 0, scale: 0.95, y: 20}}
                            className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl"
                        >
                            <div
                                className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                                <h2 className="text-lg font-black text-slate-900">Exam Configuration</h2>
                                <button onClick={() => setIsCreateModalOpen(false)}
                                        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <form onSubmit={handleCreateExam} className="p-6 space-y-5">
                                <div>
                                    <label
                                        className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Target
                                        Course</label>
                                    <select
                                        value={newExamCourseId}
                                        onChange={(e) => setNewExamCourseId(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                    >
                                        <option value="" disabled>Select a course...</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label
                                        className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Exam
                                        Title</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Fall Midterm 2026"
                                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Date</label>
                                        <input
                                            type="date"
                                            value={examDate}
                                            onChange={(e) => setExamDate(e.target.value)}
                                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Duration
                                            (Min)</label>
                                        <input
                                            type="number"
                                            min={15}
                                            value={durationMinutes}
                                            onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Sheet
                                            Format</label>
                                        <select
                                            value={optionCount}
                                            onChange={(e) => setOptionCount(Number(e.target.value) as 4 | 5)}
                                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                        >
                                            <option value={4}>4 Options (A-D)</option>
                                            <option value={5}>5 Options (A-E)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Scoring
                                            Formula</label>
                                        <select
                                            value={scoringFormula}
                                            onChange={(e) => setScoringFormula(e.target.value as any)}
                                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                        >
                                            <option value="standard">Standard (No Penalty)</option>
                                            <option value="penalty">4 Wrongs = 1 Right</option>
                                        </select>
                                    </div>
                                </div>

                                {createError && <p
                                    className="text-sm font-medium text-rose-600 flex items-center gap-1.5"><X
                                    className="h-4 w-4"/> {createError}</p>}

                                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)}
                                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit"
                                            className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 shadow-md shadow-cyan-500/20 transition-all cursor-pointer">
                                        Create Draft
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

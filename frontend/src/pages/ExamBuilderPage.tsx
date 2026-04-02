import React, {useEffect, useState} from "react"
import {useNavigate, useParams} from "react-router-dom"
import {
    ArrowLeft,
    Save,
    Copy,
    Plus,
    Trash2,
    GripVertical,
    Image as ImageIcon,
    Settings,
    CheckCircle2,
    Circle,
    AlertTriangle,
    Tag,
    BarChart,
    BrainCircuit,
    Layers,
    Type,
    X,
    Send
} from "lucide-react"
import {ApiError} from "../api/client"
import {getExamBuilderById, upsertExamBuilder, upsertExamBuilderQuestion} from "../api/exams"
import {useAcademic} from "../academic/AcademicContext"

type Difficulty = "Easy" | "Medium" | "Hard"
type BloomsTaxonomy = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create"

interface Option {
    id: string
    label: string
    text: string
}

interface DetailedQuestion {
    id: string
    text: string
    options: Option[]
    correctOptionId: string | null
    points: number
    difficulty: Difficulty
    bloomLevel: BloomsTaxonomy
    tags: string[]
}

const generateId = () => crypto.randomUUID()
const getOptionLabel = (index: number) => String.fromCharCode(65 + index)

const createEmptyQuestion = (optionCount: 4 | 5 = 4): DetailedQuestion => ({
    id: generateId(),
    text: "",
    options: Array.from({length: optionCount}, (_, idx) => ({
        id: generateId(),
        label: getOptionLabel(idx),
        text: "",
    })),
    correctOptionId: null,
    points: 10,
    difficulty: "Medium",
    bloomLevel: "Understand",
    tags: [],
})

export function ExamBuilderPage() {
    const navigate = useNavigate()
    const {id: examId} = useParams()
    const {selectedAcademicYear} = useAcademic()

    const [questions, setQuestions] = useState<DetailedQuestion[]>([createEmptyQuestion(4)])
    const [activeQuestionId, setActiveQuestionId] = useState<string>(questions[0].id)
    const [isSaving, setIsSaving] = useState(false)
    const [tagInput, setTagInput] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [examTitle, setExamTitle] = useState("Exam Builder")
    const [optionCountLimit, setOptionCountLimit] = useState<4 | 5>(4)
    const [durationMinutes, setDurationMinutes] = useState<number>(0)
    const [examDate, setExamDate] = useState("")
    const [unsavedChanges, setUnsavedChanges] = useState(false)
    const [missingAnswerQuestionIds, setMissingAnswerQuestionIds] = useState<string[]>([])

    // Drag & Drop Görsel Geri Bildirim State'leri
    const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null)

    const activeQuestionIndex = questions.findIndex((q) => q.id === activeQuestionId)
    const activeQuestion = questions[activeQuestionIndex] ?? questions[0]
    const getMissingAnswerIds = (items: DetailedQuestion[]) =>
        items.filter((question) => !question.correctOptionId).map((question) => question.id)

    useEffect(() => {
        let cancelled = false

        const run = async () => {
            if (!examId) {
                if (!cancelled) {
                    setLoadError("Exam ID is missing in route.")
                    setIsLoading(false)
                }
                return
            }

            setIsLoading(true)
            try {
                const response = await getExamBuilderById(examId, selectedAcademicYear)
                if (cancelled) return

                const mappedQuestions: DetailedQuestion[] = (response.questions ?? []).map((question) => ({
                    id: question.id,
                    text: question.text,
                    options: question.options.map((option) => ({
                        id: option.id,
                        label: option.label,
                        text: option.text,
                    })),
                    correctOptionId: question.correct_option_id,
                    points: question.points,
                    difficulty: question.difficulty,
                    bloomLevel: question.bloom_level,
                    tags: question.tags,
                }))

                const safeQuestions = mappedQuestions.length > 0 ? mappedQuestions : [createEmptyQuestion(response.option_count)]
                setQuestions(safeQuestions)
                setActiveQuestionId(safeQuestions[0].id)
                setExamTitle(response.title)
                setOptionCountLimit(response.option_count)
                setDurationMinutes(response.duration_minutes)
                setExamDate(response.exam_date)
                setLoadError(null)
                setSaveError(null)
                setUnsavedChanges(false)
                setMissingAnswerQuestionIds([])
            } catch (error) {
                if (cancelled) return
                const message = error instanceof ApiError
                    ? error.message
                    : (error instanceof Error ? error.message : "Failed to load exam builder data.")
                setLoadError(message)
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [examId, selectedAcademicYear])

    useEffect(() => {
        if (!unsavedChanges) return
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [unsavedChanges])

    const addQuestion = () => {
        const leavingQuestionId = activeQuestionId
        const newQ = createEmptyQuestion(optionCountLimit)
        const nextQuestions = [...questions, newQ]
        setQuestions(nextQuestions)
        setActiveQuestionId(newQ.id)
        setUnsavedChanges(true)
        setSaveError(null)
        setMissingAnswerQuestionIds(getMissingAnswerIds(nextQuestions))
        void persistQuestion(leavingQuestionId, questions)
    }

    const deleteQuestion = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (questions.length === 1) return

        const newQuestions = questions.filter((q) => q.id !== id)
        setQuestions(newQuestions)
        setUnsavedChanges(true)
        setSaveError(null)
        setMissingAnswerQuestionIds(getMissingAnswerIds(newQuestions))
        if (activeQuestionId === id) {
            setActiveQuestionId(newQuestions[Math.max(0, activeQuestionIndex - 1)].id)
        }
    }

    const duplicateQuestion = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        const sourceIndex = questions.findIndex((q) => q.id === id)
        if (sourceIndex < 0) return

        const source = questions[sourceIndex]
        const optionIdMap = new Map<string, string>()
        const clonedOptions = source.options.map((option) => {
            const newId = generateId()
            optionIdMap.set(option.id, newId)
            return {
                ...option,
                id: newId,
            }
        })

        const duplicated: DetailedQuestion = {
            ...source,
            id: generateId(),
            options: clonedOptions,
            correctOptionId: source.correctOptionId ? (optionIdMap.get(source.correctOptionId) ?? null) : null,
            tags: [...source.tags],
        }

        const nextQuestions = [...questions]
        nextQuestions.splice(sourceIndex + 1, 0, duplicated)
        setQuestions(nextQuestions)
        setActiveQuestionId(duplicated.id)
        setUnsavedChanges(true)
        setSaveError(null)
        setMissingAnswerQuestionIds(getMissingAnswerIds(nextQuestions))
    }

    const handleDrop = (fromId: string, toId: string, position: "before" | "after") => {
        if (fromId === toId) return

        const fromIndex = questions.findIndex((q) => q.id === fromId)
        const toIndexRaw = questions.findIndex((q) => q.id === toId)
        if (fromIndex < 0 || toIndexRaw < 0) return

        let toIndex = position === "before" ? toIndexRaw : toIndexRaw + 1

        if (fromIndex < toIndex) {
            toIndex -= 1
        }

        const nextQuestions = [...questions]
        const [moved] = nextQuestions.splice(fromIndex, 1)
        nextQuestions.splice(toIndex, 0, moved)

        setQuestions(nextQuestions)
        setUnsavedChanges(true)
        setSaveError(null)
        setMissingAnswerQuestionIds(getMissingAnswerIds(nextQuestions))
        void persistQuestion(fromId, nextQuestions)

        setDraggingQuestionId(null)
        setDragOverId(null)
        setDropPosition(null)
    }

    const updateActiveQuestion = (updates: Partial<DetailedQuestion>) => {
        const nextQuestions = questions.map((q) => (q.id === activeQuestionId ? {...q, ...updates} : q))
        setQuestions(nextQuestions)
        setUnsavedChanges(true)
        setSaveError(null)
        setMissingAnswerQuestionIds(getMissingAnswerIds(nextQuestions))
    }

    const addOption = () => {
        if (activeQuestion.options.length >= optionCountLimit) return
        const newOptions = [...activeQuestion.options, {
            id: generateId(),
            label: getOptionLabel(activeQuestion.options.length),
            text: "",
        }]
        updateActiveQuestion({options: newOptions})
    }

    const removeOption = (optionId: string) => {
        if (activeQuestion.options.length <= 2) return
        const newOptions = activeQuestion.options
            .filter((o) => o.id !== optionId)
            .map((o, idx) => ({...o, label: getOptionLabel(idx)}))

        const updates: Partial<DetailedQuestion> = {options: newOptions}
        if (activeQuestion.correctOptionId === optionId) {
            updates.correctOptionId = null
        }
        updateActiveQuestion(updates)
    }

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && tagInput.trim() !== "") {
            e.preventDefault()
            if (!activeQuestion.tags.includes(tagInput.trim())) {
                updateActiveQuestion({tags: [...activeQuestion.tags, tagInput.trim()]})
            }
            setTagInput("")
        }
    }

    const removeTag = (tagToRemove: string) => {
        updateActiveQuestion({tags: activeQuestion.tags.filter((t) => t !== tagToRemove)})
    }

    const handleSave = async () => {
        if (!examId) return

        const missingIds = getMissingAnswerIds(questions)
        setMissingAnswerQuestionIds(missingIds)

        if (missingIds.length > 0) {
            setSaveError("Some questions do not have a marked correct answer. Please fix them before saving.")
            setActiveQuestionId(missingIds[0])
            return
        }

        setIsSaving(true)
        setSaveError(null)

        try {
            const response = await upsertExamBuilder(examId, selectedAcademicYear, {
                title: examTitle,
                exam_date: examDate || undefined,
                duration_minutes: durationMinutes > 0 ? durationMinutes : undefined,
                option_count: optionCountLimit,
                questions: questions.map((question) => ({
                    id: question.id,
                    text: question.text,
                    options: question.options.map((option) => ({
                        id: option.id,
                        label: option.label as "A" | "B" | "C" | "D" | "E",
                        text: option.text,
                    })),
                    correct_option_id: question.correctOptionId,
                    points: question.points,
                    difficulty: question.difficulty,
                    bloom_level: question.bloomLevel,
                    tags: question.tags,
                })),
            })

            const mappedQuestions: DetailedQuestion[] = (response.questions ?? []).map((question) => ({
                id: question.id,
                text: question.text,
                options: question.options.map((option) => ({
                    id: option.id,
                    label: option.label,
                    text: option.text,
                })),
                correctOptionId: question.correct_option_id,
                points: question.points,
                difficulty: question.difficulty,
                bloomLevel: question.bloom_level,
                tags: question.tags,
            }))
            if (mappedQuestions.length > 0) {
                setQuestions(mappedQuestions)
                if (!mappedQuestions.some((q) => q.id === activeQuestionId)) {
                    setActiveQuestionId(mappedQuestions[0].id)
                }
            }
            setExamTitle(response.title)
            setOptionCountLimit(response.option_count)
            setDurationMinutes(response.duration_minutes)
            setExamDate(response.exam_date)
            setUnsavedChanges(false)
            setMissingAnswerQuestionIds([])
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : (error instanceof Error ? error.message : "Save failed.")
            setSaveError(message)
        } finally {
            setIsSaving(false)
        }
    }

    const persistQuestion = async (questionId: string, sourceQuestions: DetailedQuestion[]) => {
        if (!examId) return
        const questionIndex = sourceQuestions.findIndex((q) => q.id === questionId)
        if (questionIndex < 0) return
        const question = sourceQuestions[questionIndex]

        try {
            await upsertExamBuilderQuestion(examId, selectedAcademicYear, question.id, {
                question_order: questionIndex + 1,
                question: {
                    id: question.id,
                    text: question.text,
                    options: question.options.map((option) => ({
                        id: option.id,
                        label: option.label as "A" | "B" | "C" | "D" | "E",
                        text: option.text,
                    })),
                    correct_option_id: question.correctOptionId,
                    points: question.points,
                    difficulty: question.difficulty,
                    bloom_level: question.bloomLevel,
                    tags: question.tags,
                },
            })
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : (error instanceof Error ? error.message : "Auto-save failed while switching question.")
            setSaveError(message)
        }
    }

    const handleQuestionSwitch = (nextQuestionId: string) => {
        if (nextQuestionId === activeQuestionId) return
        const leavingQuestionId = activeQuestionId
        setActiveQuestionId(nextQuestionId)
        void persistQuestion(leavingQuestionId, questions)
    }

    const handleBack = () => {
        if (unsavedChanges) {
            const approved = window.confirm("You have unsaved changes. Leave this page without saving?")
            if (!approved) return
        }
        navigate(-1)
    }

    const openPublishSettings = () => {
        if (!examId) return
        if (unsavedChanges) {
            const approved = window.confirm("You have unsaved changes. Continue to publish settings anyway?")
            if (!approved) return
        }
        navigate(`/dashboard/exams/${examId}/publish`)
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-[90rem] space-y-6">
                <section
                    className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <div className="animate-pulse">
                        <div
                            className="flex items-center justify-between border-b border-slate-200/60 bg-slate-50/50 px-6 py-5">
                            <div className="space-y-2">
                                <div className="h-7 w-72 rounded-lg bg-slate-200"/>
                                <div className="h-4 w-48 rounded bg-slate-200"/>
                            </div>
                            <div className="flex gap-3">
                                <div className="h-10 w-24 rounded-xl bg-slate-200"/>
                                <div className="h-10 w-28 rounded-xl bg-slate-200"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
                            <aside className="border-b border-slate-200/60 p-4 lg:border-b-0 lg:border-r">
                                <div className="mb-3 h-5 w-28 rounded bg-slate-200"/>
                                <div className="space-y-2">
                                    <div className="h-16 rounded-xl bg-slate-200"/>
                                    <div className="h-16 rounded-xl bg-slate-200"/>
                                </div>
                            </aside>
                            <main className="border-b border-slate-200/60 p-6 lg:border-b-0">
                                <div className="space-y-6">
                                    <div className="rounded-3xl border border-slate-100 p-6">
                                        <div className="mb-4 h-6 w-40 rounded bg-slate-200"/>
                                        <div className="h-36 rounded-xl bg-slate-200"/>
                                    </div>
                                </div>
                            </main>
                            <aside className="p-6 lg:border-l lg:border-slate-200/60">
                                <div className="mb-6 h-5 w-28 rounded bg-slate-200"/>
                                <div className="space-y-4">
                                    <div className="h-10 rounded-xl bg-slate-200"/>
                                </div>
                            </aside>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    if (!isLoading && loadError) {
        return (
            <div className="mx-auto max-w-3xl">
                <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
                    <h1 className="text-xl font-black tracking-tight text-rose-800">Exam could not be loaded</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/exams")}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Exams
                    </button>
                </section>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[90rem] space-y-6">
            <section
                className="h-[calc(100vh-11rem)] min-h-0 overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">

                {/* Header (Top Bar) */}
                <div
                    className="flex flex-col gap-4 border-b border-slate-200/60 bg-slate-50/50 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={handleBack}
                            className="mt-0.5 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                            <ArrowLeft className="h-5 w-5"/>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">{examTitle}</h1>
                            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <span className="inline-flex items-center gap-1"><Layers
                                    className="h-3.5 w-3.5"/>{questions.length} Questions</span>
                                <span>•</span>
                                <span>Total: {questions.reduce((sum, q) => sum + q.points, 0)} pts</span>
                                {durationMinutes > 0 ? (
                                    <>
                                        <span>•</span>
                                        <span>{durationMinutes} mins</span>
                                    </>
                                ) : null}
                                {examDate ? (
                                    <>
                                        <span>•</span>
                                        <span>{examDate}</span>
                                    </>
                                ) : null}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Draft Kaydet Butonu (İkincil Aksiyon) */}
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSaving ? (
                                <Settings className="h-4 w-4 animate-spin"/>
                            ) : (
                                <Save className="h-4 w-4 text-slate-400"/>
                            )}
                            {isSaving ? "Saving..." : "Save Draft"}
                        </button>

                        {/* Publish Butonu (Birincil Aksiyon) */}
                        <button
                            onClick={openPublishSettings}
                            disabled={isLoading}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <Send className="h-4 w-4"/>
                            Publish Exam
                        </button>
                    </div>
                </div>

                <div
                    className="grid h-[calc(100%-89px)] min-h-0 grid-cols-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
                    {saveError ? (
                        <div
                            className="col-span-full border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700 flex items-center justify-between">
                            <span className="flex items-center gap-2"><AlertTriangle
                                className="h-4 w-4"/> {saveError}</span>
                            <button onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-700"><X
                                className="h-4 w-4"/></button>
                        </div>
                    ) : null}

                    {/* LEFT PANEL: Navigator */}
                    <aside
                        className="flex h-full min-h-0 flex-col border-b border-slate-200/60 bg-white/70 lg:border-b-0 lg:border-r">
                        <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Navigator</h2>
                            <button
                                onClick={addQuestion}
                                className="cursor-pointer rounded-lg bg-cyan-50 p-1.5 text-cyan-600 transition-colors hover:bg-cyan-100"
                                title="Add Question"
                            >
                                <Plus className="h-4 w-4"/>
                            </button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                            {questions.map((q, index) => {
                                const isActive = q.id === activeQuestionId
                                const hasMarkedAnswer = q.correctOptionId !== null
                                const hasMissingAnswer = missingAnswerQuestionIds.includes(q.id)
                                const isDraggingThis = draggingQuestionId === q.id
                                const isDragTarget = dragOverId === q.id

                                return (
                                    <div key={q.id} className="relative">

                                        {/* Drop Indicator (Before) */}
                                        {isDragTarget && dropPosition === "before" && !isDraggingThis && (
                                            <div
                                                className="absolute -top-1 left-0 right-0 z-10 h-1 rounded-full bg-cyan-500"/>
                                        )}

                                        <div
                                            draggable
                                            onDragStart={(e) => {
                                                setDraggingQuestionId(q.id)
                                                e.dataTransfer.effectAllowed = "move"
                                            }}
                                            onDragEnd={() => {
                                                setDraggingQuestionId(null)
                                                setDragOverId(null)
                                                setDropPosition(null)
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault()
                                                e.dataTransfer.dropEffect = "move"
                                                if (!draggingQuestionId || draggingQuestionId === q.id) {
                                                    setDragOverId(null)
                                                    return
                                                }
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                const isTopHalf = e.clientY < rect.top + rect.height / 2
                                                setDragOverId(q.id)
                                                setDropPosition(isTopHalf ? "before" : "after")
                                            }}
                                            onDragLeave={(e) => {
                                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                    setDragOverId(null)
                                                    setDropPosition(null)
                                                }
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                if (draggingQuestionId && dragOverId) {
                                                    handleDrop(draggingQuestionId, dragOverId, dropPosition!)
                                                }
                                            }}
                                            onClick={() => handleQuestionSwitch(q.id)}
                                            className={`group flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-all ${
                                                isDraggingThis
                                                    ? "border-dashed border-cyan-400 bg-cyan-50/40 opacity-50"
                                                    : hasMissingAnswer
                                                        ? "border-rose-300 bg-rose-50/60"
                                                        : isActive
                                                            ? "border-cyan-300 bg-cyan-50 shadow-sm"
                                                            : "border-slate-200/50 bg-white hover:border-slate-200"
                                            }`}
                                        >
                                            <GripVertical
                                                className="h-4 w-4 cursor-grab text-slate-400 opacity-60 transition-opacity group-hover:opacity-100"/>

                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span
                                                        className={`text-xs font-black ${isActive ? "text-cyan-700" : "text-slate-600"}`}>Q{index + 1}</span>
                                                    {hasMissingAnswer ? (
                                                        <AlertTriangle className="h-3 w-3 text-rose-500"/>
                                                    ) : hasMarkedAnswer ?
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500"/> :
                                                        <Circle className="h-3 w-3 text-amber-300"/>}
                                                </div>
                                                <p className={`truncate text-xs ${isActive ? "text-cyan-900" : "text-slate-500"}`}>
                                                    {q.text ||
                                                        <span className="italic opacity-50">Empty question...</span>}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => duplicateQuestion(e, q.id)}
                                                    className="rounded p-1 text-slate-400 opacity-0 transition-colors hover:bg-cyan-100 hover:text-cyan-600 group-hover:opacity-100"
                                                    title="Duplicate question"
                                                >
                                                    <Copy className="h-3.5 w-3.5"/>
                                                </button>
                                                <button
                                                    onClick={(e) => deleteQuestion(e, q.id)}
                                                    className={`rounded p-1 opacity-0 transition-colors hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 ${questions.length === 1 ? "hidden" : ""}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5"/>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Drop Indicator (After) */}
                                        {isDragTarget && dropPosition === "after" && !isDraggingThis && (
                                            <div
                                                className="absolute -bottom-1 left-0 right-0 z-10 h-1 rounded-full bg-cyan-500"/>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </aside>

                    {/* CENTER PANEL: Editor */}
                    <main
                        className="h-full min-h-0 overflow-y-auto border-b border-slate-200/60 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.04),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-5 lg:border-b-0 lg:p-7">
                        <div
                            key={activeQuestionId}
                            className="mx-auto max-w-3xl space-y-6"
                        >
                            <div
                                className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                                            {activeQuestionIndex + 1}
                                        </div>
                                        <h2 className="text-lg font-black text-slate-800">Question Prompt</h2>
                                    </div>
                                    <button
                                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                                        <ImageIcon className="h-4 w-4"/> Add Media
                                    </button>
                                </div>

                                <textarea
                                    value={activeQuestion.text}
                                    onChange={(e) => updateActiveQuestion({text: e.target.value})}
                                    placeholder="Type your question here..."
                                    className="min-h-[150px] w-full resize-y rounded-xl border-none bg-slate-50 p-4 text-base font-medium text-slate-800 caret-slate-900 outline-none ring-1 ring-slate-200 transition-shadow focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div
                                className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                    <h2 className="text-lg font-black text-slate-800">Answer Options</h2>
                                    <span
                                        className="text-xs font-medium text-slate-500">Select the correct answer</span>
                                </div>

                                <div className="space-y-3">
                                    {activeQuestion.options.map((option) => {
                                        const isCorrect = activeQuestion.correctOptionId === option.id
                                        return (
                                            <div
                                                key={option.id}
                                                className={`group relative flex items-center gap-3 rounded-2xl border p-2 transition-colors ${
                                                    isCorrect ? "border-emerald-400 bg-emerald-50/50 ring-4 ring-emerald-500/10" : "border-slate-200 bg-white hover:border-slate-300"
                                                }`}
                                            >
                                                <button
                                                    onClick={() => updateActiveQuestion({correctOptionId: option.id})}
                                                    className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-sm font-black transition-colors ${
                                                        isCorrect ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>

                                                <input
                                                    type="text"
                                                    value={option.text}
                                                    onChange={(e) => {
                                                        const newOpts = activeQuestion.options.map((o) => (o.id === option.id ? {
                                                            ...o,
                                                            text: e.target.value
                                                        } : o))
                                                        updateActiveQuestion({options: newOpts})
                                                    }}
                                                    placeholder={`Option ${option.label}...`}
                                                    className={`flex-1 bg-transparent px-2 py-2 text-sm font-medium caret-slate-900 outline-none ${isCorrect ? "text-emerald-900" : "text-slate-800"}`}
                                                />

                                                <button
                                                    onClick={() => removeOption(option.id)}
                                                    disabled={activeQuestion.options.length <= 2}
                                                    className="mr-2 rounded-lg p-2 text-slate-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:hidden"
                                                >
                                                    <Trash2 className="h-4 w-4"/>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                <button
                                    onClick={addOption}
                                    disabled={activeQuestion.options.length >= optionCountLimit}
                                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-bold text-slate-500 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4"/> Add Option
                                </button>
                            </div>
                        </div>
                    </main>

                    {/* RIGHT PANEL: Properties */}
                    <aside className="h-full min-h-0 overflow-y-auto bg-white p-6 lg:border-l lg:border-slate-200/60">
                        <h2 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
                            <Settings className="h-4 w-4 text-slate-400"/> Properties
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label
                                    className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                                    <BarChart className="h-3.5 w-3.5"/> Point Value
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={0}
                                        value={activeQuestion.points}
                                        onChange={(e) => updateActiveQuestion({points: Number(e.target.value)})}
                                        className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-center text-sm font-bold text-slate-800 caret-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                    <span className="text-sm font-medium text-slate-500">Points</span>
                                </div>
                            </div>

                            <div>
                                <label
                                    className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                                    <BrainCircuit className="h-3.5 w-3.5"/> Difficulty
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["Easy", "Medium", "Hard"] as Difficulty[]).map((diff) => (
                                        <button
                                            key={diff}
                                            onClick={() => updateActiveQuestion({difficulty: diff})}
                                            className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                                                activeQuestion.difficulty === diff
                                                    ? diff === "Easy"
                                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                        : diff === "Medium"
                                                            ? "border-amber-300 bg-amber-50 text-amber-700"
                                                            : "border-rose-300 bg-rose-50 text-rose-700"
                                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                            }`}
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label
                                    className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                                    <Layers className="h-3.5 w-3.5"/> Bloom's Level
                                </label>
                                <select
                                    value={activeQuestion.bloomLevel}
                                    onChange={(e) => updateActiveQuestion({bloomLevel: e.target.value as BloomsTaxonomy})}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                >
                                    <option value="Remember">Knowledge (Remember)</option>
                                    <option value="Understand">Comprehension (Understand)</option>
                                    <option value="Apply">Application (Apply)</option>
                                    <option value="Analyze">Analysis (Analyze)</option>
                                    <option value="Evaluate">Evaluation (Evaluate)</option>
                                    <option value="Create">Synthesis (Create)</option>
                                </select>
                            </div>

                            <div>
                                <label
                                    className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                                    <Tag className="h-3.5 w-3.5"/> Tags & Topics
                                </label>

                                <div className="mb-3 flex flex-wrap gap-2">
                                    {activeQuestion.tags.map((tag) => (
                                        <span key={tag}
                                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                            {tag}
                                            <button onClick={() => removeTag(tag)}
                                                    className="ml-0.5 text-slate-400 hover:text-rose-500 transition-colors">
                                                <X className="h-3 w-3"/>
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                <div className="relative">
                                    <Type className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        placeholder="Add tag and press Enter..."
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium caret-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </div>
    )
}

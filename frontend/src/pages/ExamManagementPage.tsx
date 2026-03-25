import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAcademic } from "../academic/AcademicContext"
import type { Exam, ExamQuestion, OptionLabel } from "../academic/types"

const optionLabels: OptionLabel[] = ["A", "B", "C", "D", "E"]

interface DraftQuestion extends ExamQuestion {}

function createDraftQuestion(index: number): DraftQuestion {
  return {
    id: `draft-q-${index}-${crypto.randomUUID()}`,
    text: "",
    correctOption: "A",
  }
}

function BubbleSheetPreview({ exam }: { exam: Exam }) {
  const visibleOptions = optionLabels.slice(0, exam.optionCount)

  return (
    <section className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <h2 className="text-xl font-black text-slate-900">Bubble Sheet Preview</h2>
      <p className="mt-1 text-sm text-slate-500">
        {exam.title} | {exam.questions.length} questions | {exam.optionCount} options
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {exam.questions.map((question, index) => (
          <div key={question.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">Q{index + 1}</span>
            <div className="flex gap-2">
              {visibleOptions.map((option) => (
                <div
                  key={`${question.id}-${option}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                    option === question.correctOption ? "border-cyan-500 bg-cyan-100 text-cyan-800" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ExamManagementPage() {
  const { courses, createExam, getCourseById, getExamsByCourse } = useAcademic()
  const [searchParams] = useSearchParams()
  const initialCourseId = searchParams.get("courseId") ?? ""
  const [courseId, setCourseId] = useState(initialCourseId)
  const [title, setTitle] = useState("")
  const [examDate, setExamDate] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [optionCount, setOptionCount] = useState<4 | 5>(4)
  const [questions, setQuestions] = useState<DraftQuestion[]>([createDraftQuestion(1)])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [previewExam, setPreviewExam] = useState<Exam | null>(null)

  const selectedCourse = getCourseById(courseId)
  const courseExams = useMemo(() => (courseId ? getExamsByCourse(courseId) : []), [courseId, getExamsByCourse])

  const updateQuestion = (questionId: string, field: keyof DraftQuestion, value: string) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) return question
        if (field === "correctOption") return { ...question, correctOption: value as OptionLabel }
        return { ...question, [field]: value }
      }),
    )
  }

  const addQuestion = () => {
    setQuestions((current) => [...current, createDraftQuestion(current.length + 1)])
  }

  const removeQuestion = (questionId: string) => {
    setQuestions((current) => current.filter((question) => question.id !== questionId))
  }

  const resetExamForm = () => {
    setTitle("")
    setExamDate("")
    setDurationMinutes(60)
    setOptionCount(4)
    setQuestions([createDraftQuestion(1)])
  }

  const submitExam = () => {
    if (!courseId) {
      setError("Select a course first.")
      return
    }
    if (!title.trim()) {
      setError("Exam title is required.")
      return
    }
    if (questions.length === 0) {
      setError("Add at least one question.")
      return
    }
    if (questions.some((question) => !question.text.trim())) {
      setError("Every question must have text.")
      return
    }

    const exam = createExam({
      courseId,
      title: title.trim(),
      examDate: examDate || new Date().toISOString().slice(0, 10),
      durationMinutes,
      optionCount,
      questions: questions.map((question) => ({
        id: question.id,
        text: question.text.trim(),
        correctOption: question.correctOption,
      })),
    })

    setPreviewExam(exam)
    setSuccess("Exam created and bubble sheet generated.")
    setError(null)
    resetExamForm()
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Exam Management</h1>
        <p className="mt-1 text-sm text-slate-500">Build exams question by question, then generate a bubble sheet preview.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Course</label>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              placeholder="Midterm 1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam Date</label>
            <input
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Duration (min)</label>
              <input
                type="number"
                min={10}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Options</label>
              <select
                value={optionCount}
                onChange={(event) => setOptionCount(Number(event.target.value) as 4 | 5)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value={4}>4 (A-D)</option>
                <option value={5}>5 (A-E)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Questions</h2>
            <button type="button" onClick={addQuestion} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
              Add Question
            </button>
          </div>

          {questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Question {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  disabled={questions.length === 1}
                  className="text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <textarea
                value={question.text}
                onChange={(event) => updateQuestion(question.id, "text", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder={`Write question ${index + 1}...`}
              />

              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Correct Option</label>
                <select
                  value={question.correctOption}
                  onChange={(event) => updateQuestion(question.id, "correctOption", event.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {optionLabels.slice(0, optionCount).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

        <button onClick={submitExam} className="mt-5 h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700">
          Create Exam and Generate Bubble Sheet
        </button>
      </section>

      <section className="space-y-6">
        <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-black text-slate-900">Course Exams</h2>
          <p className="mt-1 text-sm text-slate-500">Selected course: {selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "None"}</p>

          <div className="mt-4 space-y-2">
            {courseExams.length === 0 ? <p className="text-sm text-slate-500">No exams found for this course.</p> : null}
            {courseExams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => setPreviewExam(exam)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-cyan-300 hover:bg-cyan-50"
              >
                <p className="text-sm font-semibold text-slate-900">{exam.title}</p>
                <p className="text-xs text-slate-500">
                  {exam.questions.length} questions | {exam.examDate}
                </p>
              </button>
            ))}
          </div>
        </article>

        {previewExam ? <BubbleSheetPreview exam={previewExam} /> : null}
      </section>
    </div>
  )
}

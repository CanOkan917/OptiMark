import { useMemo, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAcademic } from "../academic/AcademicContext"

interface CourseFormState {
  name: string
  code: string
  description: string
  teacherIds: string[]
}

const initialCourseForm: CourseFormState = {
  name: "",
  code: "",
  description: "",
  teacherIds: [],
}

export function CourseManagementPage() {
  const navigate = useNavigate()
  const { teachers, courses, addTeacher, addCourse, getTeachersByIds } = useAcademic()
  const [teacherName, setTeacherName] = useState("")
  const [teacherEmail, setTeacherEmail] = useState("")
  const [courseForm, setCourseForm] = useState<CourseFormState>(initialCourseForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [courses],
  )

  const submitTeacher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!teacherName.trim() || !teacherEmail.trim()) {
      setError("Teacher name and email are required.")
      return
    }

    addTeacher({ name: teacherName.trim(), email: teacherEmail.trim() })
    setTeacherName("")
    setTeacherEmail("")
    setError(null)
    setSuccess("Teacher added to pool.")
  }

  const toggleTeacher = (teacherId: string) => {
    setCourseForm((current) => {
      const exists = current.teacherIds.includes(teacherId)
      return {
        ...current,
        teacherIds: exists ? current.teacherIds.filter((id) => id !== teacherId) : [...current.teacherIds, teacherId],
      }
    })
  }

  const submitCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!courseForm.name.trim() || !courseForm.code.trim()) {
      setError("Course name and code are required.")
      return
    }
    if (courseForm.teacherIds.length === 0) {
      setError("Assign at least one teacher to the course.")
      return
    }

    addCourse({
      name: courseForm.name.trim(),
      code: courseForm.code.trim().toUpperCase(),
      description: courseForm.description.trim(),
      teacherIds: courseForm.teacherIds,
    })

    setCourseForm(initialCourseForm)
    setError(null)
    setSuccess("Course created successfully.")
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Course Management</h1>
        <p className="mt-1 text-sm text-slate-500">Create courses and assign one or more teachers.</p>

        <form className="mt-6 space-y-5" onSubmit={submitCourse}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Course Name</label>
              <input
                value={courseForm.name}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Physics 101"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Course Code</label>
              <input
                value={courseForm.code}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, code: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="PHY101"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={courseForm.description}
              onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
              className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              placeholder="Describe the scope of this course..."
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Assign Teachers</p>
            <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {teachers.map((teacher) => (
                <label key={teacher.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={courseForm.teacherIds.includes(teacher.id)}
                    onChange={() => toggleTeacher(teacher.id)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>{teacher.name}</span>
                  <span className="text-slate-400">({teacher.email})</span>
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

          <button className="h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700">Create Course</button>
        </form>
      </section>

      <section className="space-y-6">
        <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-black text-slate-900">Teacher Pool</h2>
          <form className="mt-4 space-y-3" onSubmit={submitTeacher}>
            <input
              value={teacherName}
              onChange={(event) => setTeacherName(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              placeholder="Teacher name"
            />
            <input
              type="email"
              value={teacherEmail}
              onChange={(event) => setTeacherEmail(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              placeholder="teacher@school.com"
            />
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Add Teacher</button>
          </form>
        </article>

        <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-black text-slate-900">Courses</h2>
          <div className="mt-4 space-y-3">
            {sortedCourses.length === 0 ? <p className="text-sm text-slate-500">No courses created yet.</p> : null}
            {sortedCourses.map((course) => {
              const assignedTeachers = getTeachersByIds(course.teacherIds)
              return (
                <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{course.name}</p>
                      <p className="text-xs text-slate-500">{course.code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/exams?courseId=${encodeURIComponent(course.id)}`)}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                    >
                      Manage Exams
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{course.description || "No description."}</p>
                  <p className="mt-2 text-xs text-slate-500">Teachers: {assignedTeachers.map((teacher) => teacher.name).join(", ") || "-"}</p>
                </div>
              )
            })}
          </div>
        </article>
      </section>
    </div>
  )
}

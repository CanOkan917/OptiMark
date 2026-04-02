import {useEffect, useMemo, useState, type FormEvent} from "react"
import {useNavigate} from "react-router-dom"
import {useAcademic} from "../academic/AcademicContext"
import {BookOpen, Search, Users, Plus, MoreVertical, GraduationCap, X, Check} from "lucide-react"
import {motion, AnimatePresence} from "framer-motion"
import {ApiError} from "../api/client"

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
    const {teachers, courses, addCourse, deleteCourse, getTeachersByIds, refreshCourses, refreshTeachers} = useAcademic()

    // UI States
    const [courseForm, setCourseForm] = useState<CourseFormState>(initialCourseForm)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [teacherSearchTerm, setTeacherSearchTerm] = useState("")
    const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false)

    // Feedback States
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const filteredCourses = useMemo(
        () => [...courses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [courses],
    )

    const filteredTeachers = useMemo(() => {
        if (!teacherSearchTerm) return teachers
        const lowerQuery = teacherSearchTerm.toLowerCase()
        return teachers.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.email.toLowerCase().includes(lowerQuery)
        )
    }, [teachers, teacherSearchTerm])

    const toggleTeacherSelection = (teacherId: string) => {
        setCourseForm((current) => {
            const exists = current.teacherIds.includes(teacherId)
            return {
                ...current,
                teacherIds: exists
                    ? current.teacherIds.filter((id) => id !== teacherId)
                    : [...current.teacherIds, teacherId],
            }
        })
    }

    const removeTeacher = (teacherId: string) => {
        setCourseForm(prev => ({
            ...prev,
            teacherIds: prev.teacherIds.filter(id => id !== teacherId)
        }))
    }

    useEffect(() => {
        if (!isTeacherDropdownOpen) return

        const timer = window.setTimeout(() => {
            void refreshTeachers(teacherSearchTerm)
        }, 250)

        return () => window.clearTimeout(timer)
    }, [isTeacherDropdownOpen, refreshTeachers, teacherSearchTerm])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshCourses(searchTerm)
        }, 250)
        return () => window.clearTimeout(timer)
    }, [refreshCourses, searchTerm])

    const handleDeleteCourse = async (courseId: string, courseCode: string) => {
        const confirmed = window.confirm(`${courseCode} kursunu silmek istediğine emin misin?`)
        if (!confirmed) return

        try {
            await deleteCourse(courseId)
            setSuccess(`${courseCode} removed.`)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message)
                return
            }
            setError("Course could not be deleted.")
        }
    }

    const submitCourse = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        if (!courseForm.name.trim() || !courseForm.code.trim()) {
            setError("Course name and code are strictly required.")
            return
        }

        try {
            await addCourse({
                name: courseForm.name.trim(),
                code: courseForm.code.trim().toUpperCase(),
                description: courseForm.description.trim(),
                teacherIds: courseForm.teacherIds,
            })

            setCourseForm(initialCourseForm)
            setSuccess(`${courseForm.code} has been successfully added to the catalog.`)
            setTimeout(() => setSuccess(null), 3000)
            setIsFormOpen(false)
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message)
                return
            }
            setError("Course could not be created.")
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">

            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Course Directory</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Manage academic courses, assign department faculty, and organize exams.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
                >
                    {isFormOpen ? <X className="h-4 w-4"/> : <Plus className="h-4 w-4"/>}
                    {isFormOpen ? "Cancel Creation" : "Create New Course"}
                </button>
            </div>

            <AnimatePresence>
                {isFormOpen && (
                    <motion.section
                        initial={{height: 0, opacity: 0, y: -10}}
                        animate={{height: "auto", opacity: 1, y: 0}}
                        exit={{height: 0, opacity: 0, y: -10}}
                        className="overflow-hidden"
                    >
                        <div
                            className="rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-white to-cyan-50/30 p-6 shadow-[0_8px_30px_rgba(6,182,212,0.06)]">
                            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <BookOpen className="h-5 w-5 text-cyan-600"/>
                                <h2 className="text-lg font-black text-slate-900">Course Creation Panel</h2>
                            </div>

                            <form onSubmit={submitCourse} className="space-y-5">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label
                                                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Course
                                                    Code *</label>
                                                <input
                                                    value={courseForm.code}
                                                    onChange={(e) => setCourseForm(prev => ({
                                                        ...prev,
                                                        code: e.target.value.toUpperCase()
                                                    }))}
                                                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 uppercase placeholder:normal-case"
                                                    placeholder="e.g. PHY101"
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Course
                                                    Name *</label>
                                                <input
                                                    value={courseForm.name}
                                                    onChange={(e) => setCourseForm(prev => ({
                                                        ...prev,
                                                        name: e.target.value
                                                    }))}
                                                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                    placeholder="e.g. Advanced Physics"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label
                                                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Syllabus
                                                / Description</label>
                                            <textarea
                                                value={courseForm.description}
                                                onChange={(e) => setCourseForm(prev => ({
                                                    ...prev,
                                                    description: e.target.value
                                                }))}
                                                className="min-h-[100px] w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                placeholder="Brief overview of the course curriculum..."
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <label
                                            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Assign
                                            Instructors</label>

                                        <div className="mb-3 flex flex-wrap gap-2 min-h-[32px]">
                                            {courseForm.teacherIds.length === 0 && (
                                                <span className="text-sm italic text-slate-400 mt-1">No instructors assigned yet.</span>
                                            )}
                                            {courseForm.teacherIds.map(id => {
                                                const t = teachers.find(x => x.id === id)
                                                if (!t) return null
                                                return (
                                                    <span key={id}
                                                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 pl-2.5 pr-1.5 py-1 text-xs font-bold text-slate-700">
                                                        {t.name}
                                                        <button type="button" onClick={() => removeTeacher(id)}
                                                                className="rounded-md p-0.5 hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer">
                                                            <X className="h-3 w-3"/>
                                                        </button>
                                                    </span>
                                                )
                                            })}
                                        </div>

                                        <div className="relative">
                                            <div
                                                className="flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-slate-300 px-3 text-sm text-slate-500 transition-colors hover:border-slate-400"
                                                onClick={() => setIsTeacherDropdownOpen(!isTeacherDropdownOpen)}
                                            >
                                                <span>Search and add instructors...</span>
                                                <Users className="h-4 w-4 text-slate-400"/>
                                            </div>

                                            <AnimatePresence>
                                                {isTeacherDropdownOpen && (
                                                    <motion.div
                                                        initial={{opacity: 0, y: 5}}
                                                        animate={{opacity: 1, y: 0}}
                                                        exit={{opacity: 0, y: 5}}
                                                        className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                                                    >
                                                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                                            <input
                                                                type="text"
                                                                placeholder="Type a name..."
                                                                value={teacherSearchTerm}
                                                                onChange={(e) => setTeacherSearchTerm(e.target.value)}
                                                                className="h-8 w-full rounded-lg border-none bg-white px-3 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-cyan-500"
                                                            />
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto p-1">
                                                            {filteredTeachers.length === 0 ? (
                                                                <div
                                                                    className="p-3 text-center text-xs text-slate-500">No
                                                                    faculty found.</div>
                                                            ) : (
                                                                filteredTeachers.map(t => {
                                                                    const isSelected = courseForm.teacherIds.includes(t.id)
                                                                    return (
                                                                        <div
                                                                            key={t.id}
                                                                            onClick={() => toggleTeacherSelection(t.id)}
                                                                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${isSelected ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                                        >
                                                                            <div>
                                                                                <p className="font-semibold">{t.name}</p>
                                                                                <p className="text-xs text-slate-500">{t.email}</p>
                                                                            </div>
                                                                            {isSelected && <Check
                                                                                className="h-4 w-4 text-cyan-600"/>}
                                                                        </div>
                                                                    )
                                                                })
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                                    <div className="flex-1">
                                        {error &&
                                            <p className="text-sm font-medium text-rose-600 flex items-center gap-1.5">
                                                <X className="h-4 w-4"/> {error}</p>}
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setIsFormOpen(false)}
                                                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button type="submit"
                                                className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 transition-colors cursor-pointer shadow-md shadow-cyan-500/20">
                                            Save Course
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            <section
                className="rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
                <div
                    className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="Search by course name or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                    </div>
                    <div className="text-sm font-semibold text-slate-500">
                        Total: {filteredCourses.length} courses
                    </div>
                </div>

                <AnimatePresence>
                    {success && (
                        <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: "auto"}}
                                    exit={{opacity: 0, height: 0}}
                                    className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex items-center gap-2 text-sm font-bold text-emerald-700">
                            <Check className="h-4 w-4"/> {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100">
                    {filteredCourses.length === 0 ? (
                        <div className="py-12 text-center">
                            <GraduationCap className="mx-auto h-12 w-12 text-slate-300 mb-3"/>
                            <h3 className="text-lg font-bold text-slate-900">No courses found</h3>
                            <p className="text-sm text-slate-500">Try adjusting your search or create a new course.</p>
                        </div>
                    ) : (
                        filteredCourses.map((course) => {
                            const assignedTeachers = getTeachersByIds(course.teacherIds)
                            return (
                                <motion.div
                                    layout
                                    initial={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    key={course.id}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors gap-4"
                                >
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                                            <span className="font-black text-sm">{course.code.substring(0, 3)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-900 truncate">{course.name}</h3>
                                                <span
                                                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">{course.code}</span>
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500 line-clamp-1">{course.description || "No syllabus provided."}</p>

                                            <div className="mt-3 flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5 text-slate-400"/>
                                                <span className="text-xs font-semibold text-slate-600">
                                                    {assignedTeachers.length > 0
                                                        ? assignedTeachers.map(t => t.name).join(", ")
                                                        : "No instructors assigned"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className="flex items-center gap-3 shrink-0 sm:pl-4 sm:border-l border-slate-200/60">
                                        <button
                                            onClick={() => navigate(`/dashboard/exams?courseId=${encodeURIComponent(course.id)}`)}
                                            className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-cyan-300 hover:text-cyan-700 cursor-pointer"
                                        >
                                            Manage Exams
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteCourse(course.id, course.code)}
                                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer">
                                            <MoreVertical className="h-5 w-5"/>
                                        </button>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </section>
        </div>
    )
}

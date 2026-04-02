import {useMemo} from "react"
import {Link, useNavigate, useParams} from "react-router-dom"
import {
    ArrowLeft,
    Mail,
    Hash,
    Layers3,
    CalendarCheck2,
    AlertTriangle,
    GraduationCap,
    Pencil,
    Trash2,
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {formatDateTime} from "../mocks/students"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

export function StudentDetailPage() {
    const navigate = useNavigate()
    const {selectedAcademicYear} = useAcademic()
    const {students: allStudents, groups: allGroups, deleteStudent} = useStudentsMock()
    const {studentId} = useParams()

    const student = useMemo(
        () => allStudents.find((item) => item.id === studentId && item.academicYear === selectedAcademicYear),
        [allStudents, selectedAcademicYear, studentId],
    )

    const groups = useMemo(() => {
        if (!student) return []
        return allGroups.filter((group) => group.academicYear === selectedAcademicYear && student.groupIds.includes(group.id))
    }, [allGroups, selectedAcademicYear, student])

    const handleDelete = async () => {
        if (!studentId || !student) return
        const confirmed = window.confirm(`Delete student "${student.fullName}"?`)
        if (!confirmed) return
        try {
            await deleteStudent(studentId)
            navigate("/dashboard/students")
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : (error instanceof Error ? error.message : "Student could not be deleted.")
            window.alert(message)
        }
    }

    if (!student) {
        return (
            <div className="mx-auto mt-10 max-w-3xl">
                <section className="rounded-[32px] border border-rose-200/60 bg-rose-50 p-10 text-center shadow-sm">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-rose-400"/>
                    <h1 className="text-2xl font-black text-rose-900">Student Not Found</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">
                        This student record could not be found for <strong>{selectedAcademicYear}</strong>.
                    </p>
                    <Link
                        to="/dashboard/students"
                        className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 border border-rose-200"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Directory
                    </Link>
                </section>
            </div>
        )
    }

    const initials = student.fullName
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()

    const isActive = student.status === "active"

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    to="/dashboard/students"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_4px_15px_rgba(15,23,42,0.06)] active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4"/> Directory
                </Link>
                <div className="flex items-center gap-2">
                    <Link
                        to={`/dashboard/students/${student.id}/edit`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Pencil className="h-4 w-4"/> Edit Student
                    </Link>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                    >
                        <Trash2 className="h-4 w-4"/> Delete Student
                    </button>
                </div>
            </div>

            <section className="relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="h-32 w-full bg-gradient-to-r from-cyan-500 to-blue-600 opacity-90">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]"/>
                </div>

                <div className="px-8 pb-8 relative">
                    <div className="absolute -top-16 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-3xl font-black text-slate-600 shadow-md">
                        {initials}
                    </div>

                    <div className="pt-12 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-950">{student.fullName}</h1>
                            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
                                <GraduationCap className="h-4 w-4"/> {selectedAcademicYear} Academic Year
                            </p>
                        </div>

                        <div className="shrink-0">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                                isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-slate-100 text-slate-600 border border-slate-200/60"
                            }`}>
                                {isActive && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/>}
                                {student.status}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="group rounded-[24px] border border-slate-200/60 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                        <Hash className="h-5 w-5"/>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Student ID</p>
                    <p className="mt-1 text-lg font-black text-slate-900 font-mono">{student.studentNo}</p>
                </div>

                <div className="group rounded-[24px] border border-slate-200/60 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                        <Mail className="h-5 w-5"/>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Email Address</p>
                    <p className="mt-1 text-lg font-black text-slate-900 truncate" title={student.email}>{student.email}</p>
                </div>

                <div className="group rounded-[24px] border border-slate-200/60 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                        <Layers3 className="h-5 w-5"/>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Enrolled Groups</p>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                        {groups.length > 0 ? groups.map((group) => (
                            <Link
                                key={group.id}
                                to={`/dashboard/students/groups/${group.id}`}
                                className="inline-flex cursor-pointer items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100 hover:border-cyan-300"
                            >
                                {group.code}
                            </Link>
                        )) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-100">
                                <AlertTriangle className="h-3 w-3"/> Unassigned
                            </span>
                        )}
                    </div>
                </div>

                <div className="group rounded-[24px] border border-slate-200/60 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                        <CalendarCheck2 className="h-5 w-5"/>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Last System Sync</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatDateTime(student.lastImportAt)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-emerald-600">via CSV Import</p>
                </div>
            </div>
        </div>
    )
}

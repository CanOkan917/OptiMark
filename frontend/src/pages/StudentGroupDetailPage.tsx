import {useMemo} from "react"
import {Link, useNavigate, useParams} from "react-router-dom"
import {
    ArrowLeft,
    UserRoundCheck,
    Info,
    Users,
    GraduationCap,
    Percent,
    Mail,
    Hash,
    AlertTriangle,
    BookOpen,
    Pencil,
    Trash2,
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

export function StudentGroupDetailPage() {
    const navigate = useNavigate()
    const {selectedAcademicYear} = useAcademic()
    const {groups: allGroups, students: allStudents, deleteGroup} = useStudentsMock()
    const {groupId} = useParams()

    const group = useMemo(
        () => allGroups.find((item) => item.id === groupId && item.academicYear === selectedAcademicYear),
        [allGroups, groupId, selectedAcademicYear],
    )

    const students = useMemo(
        () => allStudents.filter((item) => item.academicYear === selectedAcademicYear && item.groupIds.includes(groupId ?? "")),
        [allStudents, groupId, selectedAcademicYear],
    )

    const handleDeleteGroup = async () => {
        if (!groupId || !group) return
        const confirmed = window.confirm(
            `Delete "${group.code} - ${group.name}"?\nStudents will remain but removed from this group.`,
        )
        if (!confirmed) return
        try {
            await deleteGroup(groupId)
            navigate("/dashboard/students/groups")
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : (error instanceof Error ? error.message : "Group could not be deleted.")
            window.alert(message)
        }
    }

    if (!group) {
        return (
            <div className="mx-auto mt-10 max-w-3xl">
                <section className="rounded-3xl border border-rose-200/60 bg-rose-50 p-10 text-center shadow-sm">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-rose-400"/>
                    <h1 className="text-2xl font-black text-rose-900">Group Not Found</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">
                        We could not locate this group for <strong>{selectedAcademicYear}</strong>.
                    </p>
                    <Link
                        to="/dashboard/students/groups"
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 border border-rose-200"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Directory
                    </Link>
                </section>
            </div>
        )
    }

    const occupancyRate = Math.min(100, Math.round((students.length / group.capacity) * 100))
    const isFull = occupancyRate >= 100
    const isNearFull = occupancyRate >= 85 && !isFull

    return (
        <div className="mx-auto max-w-6xl space-y-8 pb-12">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <div className="mb-3 flex items-center gap-3">
                        <span className="inline-flex items-center rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-cyan-700 shadow-sm">
                            {group.code}
                        </span>
                        {isFull ? (
                            <span className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">Full Capacity</span>
                        ) : isNearFull ? (
                            <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">Almost Full</span>
                        ) : null}
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-950">{group.name}</h1>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600">
                        <UserRoundCheck className="h-4 w-4 text-slate-400"/>
                        Advisor: <span className="font-bold text-slate-900">{group.advisorName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/dashboard/students/groups"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_4px_15px_rgba(15,23,42,0.06)] active:scale-95"
                    >
                        <ArrowLeft className="h-4 w-4"/> Back to Groups
                    </Link>
                    <Link
                        to={`/dashboard/students/groups/${group.id}/edit`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Pencil className="h-4 w-4"/> Edit Group
                    </Link>
                    <button
                        type="button"
                        onClick={handleDeleteGroup}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                    >
                        <Trash2 className="h-4 w-4"/> Delete Group
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div className="group relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-transform hover:-translate-y-1">
                    <div className="absolute -right-4 -top-4 rounded-full bg-cyan-50 p-6 transition-transform group-hover:scale-110">
                        <Users className="h-8 w-8 text-cyan-500/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Enrolled Students</p>
                    <p className="relative z-10 mt-3 text-4xl font-black text-slate-950">{students.length}</p>
                </div>

                <div className="group relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-transform hover:-translate-y-1">
                    <div className="absolute -right-4 -top-4 rounded-full bg-slate-50 p-6 transition-transform group-hover:scale-110">
                        <GraduationCap className="h-8 w-8 text-slate-400/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Maximum Capacity</p>
                    <p className="relative z-10 mt-3 text-4xl font-black text-slate-950">{group.capacity}</p>
                </div>

                <div className={`group relative overflow-hidden rounded-[32px] border bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-transform hover:-translate-y-1 ${
                    isFull ? "border-rose-200/60" : isNearFull ? "border-amber-200/60" : "border-slate-200/60"
                }`}>
                    <div className={`absolute -right-4 -top-4 rounded-full p-6 transition-transform group-hover:scale-110 ${
                        isFull ? "bg-rose-50" : isNearFull ? "bg-amber-50" : "bg-emerald-50"
                    }`}>
                        <Percent className={`h-8 w-8 ${
                            isFull ? "text-rose-500/50" : isNearFull ? "text-amber-500/50" : "text-emerald-500/50"
                        }`}/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Occupancy Rate</p>
                    <div className="relative z-10 mt-3 flex items-end gap-4">
                        <p className={`text-4xl font-black ${
                            isFull ? "text-rose-600" : isNearFull ? "text-amber-600" : "text-emerald-600"
                        }`}>
                            {occupancyRate}%
                        </p>
                    </div>
                    <div className="relative z-10 mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                isFull ? "bg-rose-500" : isNearFull ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{width: `${occupancyRate}%`}}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
                <section className="flex flex-col overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
                        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                            <BookOpen className="h-5 w-5 text-cyan-600"/> Class Roster
                        </h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">All students currently enrolled in this section.</p>
                    </div>

                    <div className="p-6">
                        {students.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
                                <Users className="mb-4 h-12 w-12 text-slate-300"/>
                                <h3 className="text-lg font-bold text-slate-900">No students enrolled</h3>
                                <p className="mt-1 text-sm font-medium text-slate-500">This group is currently empty.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {students.map((student) => (
                                    <Link
                                        key={student.id}
                                        to={`/dashboard/students/${student.id}`}
                                        className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_8px_20px_rgba(6,182,212,0.08)]"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 font-bold text-slate-600 shadow-inner group-hover:from-cyan-50 group-hover:to-cyan-100 group-hover:text-cyan-700 transition-colors">
                                                {student.fullName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{student.fullName}</p>
                                                <div className="mt-1 flex items-center gap-3 text-xs font-medium text-slate-500">
                                                    <span className="flex items-center gap-1 shrink-0"><Hash className="h-3 w-3"/> {student.studentNo}</span>
                                                    <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3"/> {student.email}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <aside className="space-y-6">
                    <section className="rounded-[32px] border border-cyan-100 bg-cyan-50/30 p-6 shadow-[0_8px_30px_rgba(6,182,212,0.04)] relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 rounded-full bg-cyan-100/50 p-8">
                            <Info className="h-10 w-10 text-cyan-500/20"/>
                        </div>

                        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-cyan-950 relative z-10">
                            Group Guidelines
                        </h2>
                        <ul className="relative z-10 space-y-3 text-sm font-medium text-cyan-800/80">
                            <li className="flex items-start gap-2">
                                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500"/>
                                <span>Each student should belong to at least one active group in the selected academic year.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500"/>
                                <span>Group codes must be unique per academic year (e.g. <strong>{group.code}</strong>).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500"/>
                                <span>CSV imports can automatically map students to this group using the code exactly as written.</span>
                            </li>
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    )
}

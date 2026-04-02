import {useMemo, useState} from "react"
import {Link} from "react-router-dom"
import {
    Upload,
    Layers3,
    Search,
    ArrowRight,
    AlertTriangle,
    Users,
    UserMinus,
    History,
    CheckCircle2, Plus
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {formatDateTime} from "../mocks/students"
import {useStudentsMock} from "../students/StudentsMockContext"

export function StudentsPage() {
    const {selectedAcademicYear} = useAcademic()
    const {students: allStudents, groups: allGroups, importJobs} = useStudentsMock()
    const [search, setSearch] = useState("")

    const groups = useMemo(
        () => allGroups.filter((item) => item.academicYear === selectedAcademicYear),
        [allGroups, selectedAcademicYear],
    )

    const students = useMemo(() => {
        const base = allStudents.filter((item) => item.academicYear === selectedAcademicYear)
        const query = search.trim().toLowerCase()
        if (!query) return base
        return base.filter((item) =>
            item.fullName.toLowerCase().includes(query)
            || item.studentNo.toLowerCase().includes(query)
            || item.email.toLowerCase().includes(query),
        )
    }, [allStudents, search, selectedAcademicYear])

    const latestImport = useMemo(
        () => importJobs
            .filter((item) => item.academicYear === selectedAcademicYear)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0],
        [importJobs, selectedAcademicYear],
    )

    const unassignedCount = allStudents.filter((item) => item.academicYear === selectedAcademicYear && item.groupIds.length === 0).length
    const totalStudentsCount = allStudents.filter((item) => item.academicYear === selectedAcademicYear).length

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">

            {/* SAYFA BAŞLIĞI VE AKSİYONLAR */}
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Student Directory</h1>
                    <p className="mt-1.5 text-sm font-medium text-slate-500">
                        Manage roster, class groups, and import operations for <strong
                        className="text-slate-700">{selectedAcademicYear}</strong>.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/dashboard/students/groups"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_4px_15px_rgba(15,23,42,0.06)] active:scale-95"
                    >
                        <Layers3 className="h-4 w-4 text-slate-400"/> Manage Groups
                    </Link>
                    <Link
                        to="/dashboard/students/import"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-700 hover:shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95"
                    >
                        <Upload className="h-4 w-4"/> Import Roster
                    </Link>
                </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                    <div
                        className="absolute -right-4 -top-4 rounded-full bg-cyan-50 p-6 transition-transform group-hover:scale-110">
                        <Users className="h-8 w-8 text-cyan-500/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Total
                        Students</p>
                    <p className="relative z-10 mt-3 text-4xl font-black text-slate-950">{totalStudentsCount}</p>
                </div>

                <div
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                    <div
                        className="absolute -right-4 -top-4 rounded-full bg-indigo-50 p-6 transition-transform group-hover:scale-110">
                        <Layers3 className="h-8 w-8 text-indigo-500/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Active
                        Groups</p>
                    <p className="relative z-10 mt-3 text-4xl font-black text-slate-950">{groups.length}</p>
                </div>

                <div
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:border-amber-200/60">
                    <div
                        className="absolute -right-4 -top-4 rounded-full bg-amber-50 p-6 transition-transform group-hover:scale-110">
                        <UserMinus className="h-8 w-8 text-amber-500/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Unassigned</p>
                    <p className="relative z-10 mt-3 text-4xl font-black text-amber-600">{unassignedCount}</p>
                    {unassignedCount > 0 && (
                        <p className="relative z-10 mt-2 text-xs font-medium text-amber-700/70">Needs group
                            assignment</p>
                    )}
                </div>

                <div
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                    <div
                        className="absolute -right-4 -top-4 rounded-full bg-emerald-50 p-6 transition-transform group-hover:scale-110">
                        <History className="h-8 w-8 text-emerald-500/50"/>
                    </div>
                    <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-500">Last
                        Sync/Import</p>
                    <div className="relative z-10 mt-3">
                        {latestImport ? (
                            <>
                                <p className="text-lg font-black text-slate-950">{formatDateTime(latestImport.createdAt).split(',')[0]}</p>
                                <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3"/> Successful import</p>
                            </>
                        ) : (
                            <p className="text-lg font-bold text-slate-400 italic">No imports yet</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
                {/* SOL PANEL: ÖĞRENCİ LİSTESİ TABLOSU */}
                <section
                    className="flex flex-col overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <div
                        className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 sm:flex sm:items-center sm:justify-between">
                        <div className="mb-4 sm:mb-0 flex items-center gap-3">
                            <div
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                                <Users className="h-5 w-5"/>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Student Directory</h2>
                                <p className="text-xs font-medium text-slate-500">Showing {students.length} students</p>
                            </div>
                        </div>
                        <div className="relative w-full sm:max-w-xs">
                            <Search
                                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by name, ID or email..."
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-white">
                            <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-4">Student Info</th>
                                <th className="px-6 py-4">Student ID</th>
                                <th className="px-6 py-4">Groups</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                            {students.map((student) => {
                                const studentGroups = groups.filter((group) => student.groupIds.includes(group.id))
                                return (
                                    <tr key={student.id} className="group transition-colors hover:bg-slate-50/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 font-bold text-slate-600 shadow-inner">
                                                    {student.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div
                                                        className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{student.fullName}</div>
                                                    <div
                                                        className="text-xs font-medium text-slate-500">{student.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className="font-mono text-sm font-medium text-slate-600">{student.studentNo}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {studentGroups.length > 0 ? studentGroups.map((group) => (
                                                    <span
                                                        key={group.id}
                                                        title={group.name}
                                                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 border border-slate-200/60"
                                                    >
                                                            {group.code}
                                                        </span>
                                                )) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-100">
                                                            <AlertTriangle className="h-3 w-3"/> Unassigned
                                                        </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                                        student.status === "active"
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                            : "bg-slate-100 text-slate-600 border border-slate-200"
                                                    }`}>
                                                    {student.status === "active" &&
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>}
                                                    {student.status}
                                                </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/dashboard/students/${student.id}`}
                                                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-cyan-600 hover:shadow-sm"
                                                title="View Profile"
                                            >
                                                <ArrowRight className="h-5 w-5"/>
                                            </Link>
                                        </td>
                                    </tr>
                                )
                            })}
                            {students.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div
                                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
                                            <Search className="h-8 w-8 text-slate-300"/>
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900">No students found</h3>
                                        <p className="mt-1 text-sm text-slate-500">We couldn't find any students
                                            matching your search criteria.</p>
                                        <button onClick={() => setSearch("")}
                                                className="mt-4 text-sm font-bold text-cyan-600 hover:text-cyan-700">Clear
                                            search
                                        </button>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* SAĞ PANEL: GRUP ÖZETİ */}
                <aside className="space-y-6">
                    <div
                        className="rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-black text-slate-900">Group Snapshot</h2>
                            <Link to="/dashboard/students/groups"
                                  className="text-xs font-bold text-cyan-600 hover:text-cyan-700">View All</Link>
                        </div>

                        <div className="flex flex-col gap-3">
                            {groups.map((group) => {
                                const count = allStudents.filter((item) => item.academicYear === selectedAcademicYear && item.groupIds.includes(group.id)).length
                                const percentFull = Math.min(100, Math.round((count / group.capacity) * 100))

                                return (
                                    <Link
                                        key={group.id}
                                        to={`/dashboard/students/groups/${group.id}`}
                                        className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:border-cyan-200 hover:bg-white hover:shadow-md"
                                    >
                                        {/* Progress Bar Background */}
                                        <div
                                            className="absolute bottom-0 left-0 h-1 bg-cyan-400 opacity-20 transition-all group-hover:opacity-100 group-hover:bg-cyan-500"
                                            style={{width: `${percentFull}%`}}
                                        />

                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="text-xs font-black uppercase tracking-wider text-cyan-700">{group.code}</span>
                                                </div>
                                                <p className="mt-1 text-sm font-bold text-slate-900 line-clamp-1">{group.name}</p>
                                                <p className="mt-0.5 text-xs font-medium text-slate-500 truncate">Adv: {group.advisorName}</p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end">
                                                <span className="text-sm font-black text-slate-900">{count}</span>
                                                <span
                                                    className="text-[10px] font-bold uppercase text-slate-400">/ {group.capacity}</span>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                            {groups.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                                    <p className="text-sm font-medium text-slate-500">No groups defined for this
                                        academic year.</p>
                                </div>
                            )}
                        </div>

                        <Link
                            to="/dashboard/students/groups"
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                            <Plus className="h-4 w-4"/> Create New Group
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    )
}

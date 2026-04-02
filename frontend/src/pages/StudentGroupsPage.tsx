import {useMemo, useState} from "react"
import {Link, useNavigate} from "react-router-dom"
import {
    ArrowLeft,
    Users,
    GraduationCap,
    Plus,
    Search,
    UserCircle,
    Layers3,
    Pencil,
    Trash2,
    ArrowRight
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

export function StudentGroupsPage() {
    const navigate = useNavigate()
    const {selectedAcademicYear} = useAcademic()
    const {groups: groupsState, students: studentsState, deleteGroup} = useStudentsMock()
    const [searchTerm, setSearchTerm] = useState("")

    const allGroups = useMemo(
        () => groupsState.filter((item) => item.academicYear === selectedAcademicYear),
        [groupsState, selectedAcademicYear],
    )

    const students = useMemo(
        () => studentsState.filter((item) => item.academicYear === selectedAcademicYear),
        [selectedAcademicYear, studentsState],
    )

    // Arama filtresi
    const filteredGroups = useMemo(() => {
        if (!searchTerm.trim()) return allGroups
        const query = searchTerm.toLowerCase()
        return allGroups.filter(g =>
            g.name.toLowerCase().includes(query) ||
            g.code.toLowerCase().includes(query) ||
            g.advisorName.toLowerCase().includes(query)
        )
    }, [allGroups, searchTerm])

    const handleDeleteGroup = async (groupId: string, groupLabel: string) => {
        const confirmed = window.confirm(`Are you sure you want to delete "${groupLabel}"?\nStudents will remain in the system but will be removed from this group.`)
        if (!confirmed) return
        try {
            await deleteGroup(groupId)
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : (error instanceof Error ? error.message : "Group could not be deleted.")
            window.alert(message)
        }
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">

            {/* SAYFA BAŞLIĞI VE AKSİYONLAR */}
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Student Groups</h1>
                    <p className="mt-1.5 text-sm font-medium text-slate-500">
                        Manage classes, sections, and capacities for <strong
                        className="text-slate-700">{selectedAcademicYear}</strong>.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to="/dashboard/students"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_4px_15px_rgba(15,23,42,0.06)] active:scale-95"
                    >
                        <ArrowLeft className="h-4 w-4"/> Directory
                    </Link>
                    <Link
                        to="/dashboard/students/groups/new"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-700 hover:shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95"
                    >
                        <Plus className="h-4 w-4"/> Create Group
                    </Link>
                </div>
            </div>

            {/* ARAMA ÇUBUĞU */}
            <div
                className="flex w-full items-center rounded-3xl border border-slate-200/60 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by group name, code or advisor..."
                        className="h-12 w-full rounded-2xl bg-transparent pl-12 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:bg-slate-50 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-400"
                    />
                </div>
                <div className="hidden shrink-0 px-4 text-xs font-bold text-slate-400 sm:block">
                    {filteredGroups.length} {filteredGroups.length === 1 ? 'Group' : 'Groups'} Found
                </div>
            </div>

            {/* GRUP KARTLARI (GRID) */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredGroups.map((group) => {
                    const groupStudents = students.filter((student) => student.groupIds.includes(group.id))
                    const percentFull = Math.min(100, Math.round((groupStudents.length / group.capacity) * 100))
                    const isFull = percentFull >= 100
                    const isNearFull = percentFull >= 85 && !isFull

                    return (
                        <div
                            key={group.id}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:border-cyan-300/60 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
                        >
                            {/* Üst Kısım: Bilgiler */}
                            <div className="p-7 pb-6">
                                <div className="mb-5 flex items-start justify-between">
                                    <span
                                        className="inline-flex items-center rounded-xl bg-cyan-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-cyan-700 border border-cyan-100">
                                        {group.code}
                                    </span>

                                    {/* Kapasite Durum Rozeti */}
                                    {isFull ? (
                                        <span
                                            className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 border border-rose-100">Full</span>
                                    ) : isNearFull ? (
                                        <span
                                            className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 border border-amber-100">Almost Full</span>
                                    ) : null}
                                </div>

                                <h2 className="text-2xl font-black text-slate-900 group-hover:text-cyan-800 transition-colors line-clamp-1"
                                    title={group.name}>{group.name}</h2>

                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                                    <UserCircle className="h-4 w-4 text-slate-400"/>
                                    <span className="font-medium truncate">Adv: <span
                                        className="font-bold text-slate-700">{group.advisorName}</span></span>
                                </div>

                                {/* Progress Bar ve Kapasite Bilgisi */}
                                <div className="mt-8 border-t border-slate-100 pt-5">
                                    <div className="mb-2.5 flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-1.5 font-bold text-slate-800">
                                            <Users className="h-4 w-4 text-cyan-600"/>
                                            {groupStudents.length} Enrolled
                                        </span>
                                        <span className="flex items-center gap-1 font-semibold text-slate-400 text-xs">
                                            <GraduationCap className="h-3.5 w-3.5"/>
                                            {group.capacity} Max
                                        </span>
                                    </div>

                                    {/* Progress Bar Yüzdesi */}
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${
                                                isFull ? "bg-rose-500" : isNearFull ? "bg-amber-400" : "bg-cyan-500"
                                            }`}
                                            style={{width: `${percentFull}%`}}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Alt Kısım: Aksiyon Butonları */}
                            <div
                                className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-7 py-4 transition-colors group-hover:bg-cyan-50/20">
                                <Link
                                    to={`/dashboard/students/groups/${group.id}`}
                                    className="inline-flex cursor-pointer items-center gap-1 text-sm font-black text-cyan-600 transition-colors hover:text-cyan-800"
                                >
                                    Open Group <ArrowRight className="h-4 w-4"/>
                                </Link>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/dashboard/students/groups/${group.id}/edit`)}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 shadow-sm"
                                        title="Edit Group"
                                    >
                                        <Pencil className="h-3.5 w-3.5"/> Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteGroup(group.id, `${group.code} - ${group.name}`)}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
                                        title="Delete Group"
                                    >
                                        <Trash2 className="h-3.5 w-3.5"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {filteredGroups.length === 0 && (
                    <div
                        className="col-span-full flex flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-slate-50/50 py-20 text-center">
                        <Layers3 className="mb-4 h-12 w-12 text-slate-300"/>
                        <h3 className="text-lg font-bold text-slate-900">No groups found</h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">Try adjusting your search term or create
                            a new group.</p>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm("")}
                                    className="mt-4 text-sm font-bold text-cyan-600 hover:text-cyan-700">
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

import {useEffect, useMemo, useState} from "react"
import {Link, useNavigate, useParams} from "react-router-dom"
import {
    ArrowLeft,
    Save,
    AlertTriangle,
    UserRoundCog,
    User,
    Mail,
    Hash,
    GraduationCap,
    CheckCircle2,
    X,
    ShieldAlert
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

export function StudentEditPage() {
    const navigate = useNavigate()
    const {studentId} = useParams()
    const {selectedAcademicYear} = useAcademic()
    const {students, groups, updateStudent} = useStudentsMock()

    const student = useMemo(
        () => students.find((item) => item.id === studentId && item.academicYear === selectedAcademicYear),
        [selectedAcademicYear, studentId, students],
    )

    const availableGroups = useMemo(
        () => groups.filter((item) => item.academicYear === selectedAcademicYear),
        [groups, selectedAcademicYear],
    )

    const [fullName, setFullName] = useState("")
    const [studentNo, setStudentNo] = useState("")
    const [email, setEmail] = useState("")
    const [gradeLevel, setGradeLevel] = useState("")
    const [status, setStatus] = useState<"active" | "inactive">("active")
    const [groupIds, setGroupIds] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!student) return
        setFullName(student.fullName)
        setStudentNo(student.studentNo)
        setEmail(student.email)
        setGradeLevel(student.gradeLevel)
        setStatus(student.status)
        setGroupIds(student.groupIds)
    }, [student])

    const toggleGroup = (groupId: string) => {
        setGroupIds((current) => current.includes(groupId)
            ? current.filter((item) => item !== groupId)
            : [...current, groupId])
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!studentId || !student) return
        if (!fullName.trim()) {
            setError("Student name is required.")
            return
        }
        if (!studentNo.trim()) {
            setError("Student ID is required.")
            return
        }
        if (!email.trim()) {
            setError("Email is required.")
            return
        }
        try {
            await updateStudent(studentId, {
                fullName,
                studentNo,
                email,
                gradeLevel,
                status,
                groupIds,
            })
            navigate(`/dashboard/students/${studentId}`)
        } catch (error) {
            setError(
                error instanceof ApiError
                    ? error.message
                    : (error instanceof Error ? error.message : "Student could not be updated."),
            )
        }
    }

    if (!student) {
        return (
            <div className="mx-auto mt-10 max-w-3xl">
                <section className="rounded-[32px] border border-rose-200/60 bg-rose-50 p-10 text-center shadow-sm">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-400"/>
                    <h1 className="text-2xl font-black text-rose-900">Student Not Found</h1>
                    <p className="mt-2 text-sm font-medium text-rose-700">
                        This student record is not available in the <strong
                        className="font-bold">{selectedAcademicYear}</strong> academic year.
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

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-12">

            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Edit Profile</h1>
                    <p className="mt-1.5 text-sm font-medium text-slate-500">
                        Update personal and academic details for <strong
                        className="text-slate-700">{student.fullName}</strong>.
                    </p>
                </div>
                <Link
                    to={`/dashboard/students/${student.id}`}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_4px_15px_rgba(15,23,42,0.06)] active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4"/> Discard Changes
                </Link>
            </div>

            <form
                onSubmit={handleSubmit}
                className="overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
            >
                <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 shadow-inner">
                            <UserRoundCog className="h-5 w-5"/>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Student Information</h2>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Error Alert */}
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

                    {/* Section: Personal Details */}
                    <div>
                        <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Personal
                            Details</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Full
                                    Name</label>
                                <div className="relative">
                                    <User
                                        className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        placeholder="e.g. Jane Doe"
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Email
                                    Address</label>
                                <div className="relative">
                                    <Mail
                                        className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="jane.doe@school.edu"
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100"/>

                    {/* Section: Academic Profile */}
                    <div>
                        <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Academic
                            Profile</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Student
                                    ID</label>
                                <div className="relative">
                                    <Hash
                                        className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        value={studentNo}
                                        onChange={(event) => setStudentNo(event.target.value)}
                                        placeholder="e.g. 2026001"
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 font-mono outline-none transition-colors focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Grade
                                    Level</label>
                                <div className="relative">
                                    <GraduationCap
                                        className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        value={gradeLevel}
                                        onChange={(event) => setGradeLevel(event.target.value)}
                                        placeholder="e.g. 11, Freshman"
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status Toggle */}
                        <div className="mt-6">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Account
                                Status</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStatus("active")}
                                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all sm:flex-none sm:w-40 ${
                                        status === "active"
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    <span
                                        className={`h-2 w-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-slate-300"}`}/>
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus("inactive")}
                                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all sm:flex-none sm:w-40 ${
                                        status === "inactive"
                                            ? "border-slate-300 bg-slate-100 text-slate-700 shadow-sm"
                                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    <span
                                        className={`h-2 w-2 rounded-full ${status === "inactive" ? "bg-slate-500" : "bg-slate-300"}`}/>
                                    Inactive
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100"/>

                    {/* Section: Groups */}
                    <div>
                        <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Class & Group
                            Assignments</h3>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5">
                            <div className="flex flex-wrap gap-2.5">
                                {availableGroups.length === 0 && (
                                    <span className="text-sm text-slate-500 italic">No groups available for this academic year.</span>
                                )}
                                {availableGroups.map((group) => {
                                    const checked = groupIds.includes(group.id)
                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition-all hover:-translate-y-0.5 ${
                                                checked
                                                    ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 hover:shadow-sm"
                                            }`}
                                        >
                                            {checked && <CheckCircle2 className="h-4 w-4 text-cyan-600"/>}
                                            {group.code}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Footer / Actions */}
                <div className="flex items-center justify-between bg-slate-50/50 px-8 py-5 border-t border-slate-100">
                    <div className="hidden sm:block text-xs font-medium text-slate-500">
                        Changes are saved instantly to the local environment.
                    </div>
                    <div className="flex w-full sm:w-auto items-center justify-end gap-3">
                        <Link
                            to={`/dashboard/students/${student.id}`}
                            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-black text-white shadow-[0_8px_20px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-700 hover:shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95"
                        >
                            <Save className="h-4 w-4"/> Save Changes
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

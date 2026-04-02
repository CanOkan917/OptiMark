import {useEffect, useMemo, useState} from "react"
import {Link, useNavigate, useParams} from "react-router-dom"
import {ArrowLeft, Save, AlertTriangle, Plus} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

export function StudentGroupFormPage() {
    const navigate = useNavigate()
    const {groupId} = useParams()
    const isCreate = !groupId
    const {selectedAcademicYear} = useAcademic()
    const {groups, createGroup, updateGroup} = useStudentsMock()

    const group = useMemo(
        () => groups.find((item) => item.id === groupId && item.academicYear === selectedAcademicYear),
        [groupId, groups, selectedAcademicYear],
    )

    const [code, setCode] = useState("")
    const [name, setName] = useState("")
    const [advisorName, setAdvisorName] = useState("")
    const [capacity, setCapacity] = useState(30)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!group) return
        setCode(group.code)
        setName(group.name)
        setAdvisorName(group.advisorName)
        setCapacity(group.capacity)
    }, [group])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!code.trim() || !name.trim() || !advisorName.trim()) {
            setError("Code, name and advisor fields are required.")
            return
        }
        if (capacity < 1) {
            setError("Capacity must be at least 1.")
            return
        }

        const duplicateCode = groups.find((item) =>
            item.academicYear === selectedAcademicYear
            && item.code.trim().toLowerCase() === code.trim().toLowerCase()
            && item.id !== groupId,
        )

        if (duplicateCode) {
            setError("Another group with the same code already exists in this academic year.")
            return
        }

        try {
            if (isCreate) {
                const created = await createGroup({
                    academicYear: selectedAcademicYear,
                    code,
                    name,
                    advisorName,
                    capacity,
                })
                navigate(`/dashboard/students/groups/${created.id}`)
                return
            }

            if (!groupId) return
            await updateGroup(groupId, {code, name, advisorName, capacity})
            navigate(`/dashboard/students/groups/${groupId}`)
        } catch (error) {
            setError(
                error instanceof ApiError
                    ? error.message
                    : (error instanceof Error ? error.message : "Group could not be saved."),
            )
        }
    }

    if (!isCreate && !group) {
        return (
            <section className="mx-auto max-w-3xl rounded-3xl border border-rose-200/60 bg-rose-50 p-8 text-center">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-500"/>
                <h1 className="text-xl font-black text-rose-900">Group not found</h1>
                <p className="mt-2 text-sm font-medium text-rose-700">This group cannot be edited for {selectedAcademicYear}.</p>
                <Link
                    to="/dashboard/students/groups"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-rose-700"
                >
                    <ArrowLeft className="h-4 w-4"/> Back to Groups
                </Link>
            </section>
        )
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                    {isCreate ? "Create Group" : "Edit Group"}
                </h1>
                <Link
                    to={isCreate ? "/dashboard/students/groups" : `/dashboard/students/groups/${groupId}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                    <ArrowLeft className="h-4 w-4"/> Back
                </Link>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-[32px] border border-slate-200/60 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-6"
            >
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Group Code</label>
                        <input
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            placeholder="e.g. 11-A"
                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Capacity</label>
                        <input
                            type="number"
                            min={1}
                            value={capacity}
                            onChange={(event) => setCapacity(Number(event.target.value))}
                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Group Name</label>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Grade 11 Science A"
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Advisor Name</label>
                    <input
                        value={advisorName}
                        onChange={(event) => setAdvisorName(event.target.value)}
                        placeholder="e.g. Derya Aksoy"
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                    <Link
                        to={isCreate ? "/dashboard/students/groups" : `/dashboard/students/groups/${groupId}`}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-700"
                    >
                        {isCreate ? <Plus className="h-4 w-4"/> : <Save className="h-4 w-4"/>}
                        {isCreate ? "Create Group" : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    )
}

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
    UserPlus,
    Search,
    Loader2,
    AlertCircle,
    ShieldCheck,
    Shield,
    GraduationCap,
    BarChart3,
    X,
    Power,
    type LucideIcon,
} from "lucide-react"
import { useAuth } from "../auth/AuthContext"
import { ApiError } from "../api/client"
import {
    createStaff,
    listStaff,
    updateStaff,
    type StaffMember,
    type StaffRole,
} from "../api/staff"

const ROLE_META: Record<StaffRole, { label: string; icon: LucideIcon; cls: string }> = {
    admin: { label: "Admin", icon: ShieldCheck, cls: "border-violet-200 bg-violet-50 text-violet-700" },
    school_admin: { label: "School Admin", icon: Shield, cls: "border-blue-200 bg-blue-50 text-blue-700" },
    analyst: { label: "Analyst", icon: BarChart3, cls: "border-amber-200 bg-amber-50 text-amber-700" },
    teacher: { label: "Teacher", icon: GraduationCap, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
}

const FILTERS: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    { value: "teacher", label: "Teachers" },
    { value: "school_admin", label: "School Admins" },
    { value: "analyst", label: "Analysts" },
    { value: "admin", label: "Admins" },
]

function roleBadge(role: string) {
    const meta = ROLE_META[role as StaffRole]
    if (!meta) return <span className="text-slate-400">{role}</span>
    const Icon = meta.icon
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
            <Icon className="h-3.5 w-3.5" /> {meta.label}
        </span>
    )
}

const EMPTY_FORM = { full_name: "", email: "", username: "", password: "", role: "teacher" as StaffRole }

export function StaffManagementPage() {
    const { user } = useAuth()
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("all")
    const [search, setSearch] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<number | null>(null)

    const canCreateAdmin = user?.role === "admin"

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setStaff(await listStaff(filter, search))
            setError(null)
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not load staff")
        } finally {
            setLoading(false)
        }
    }, [filter, search])

    useEffect(() => {
        const t = setTimeout(() => void load(), 250)
        return () => clearTimeout(t)
    }, [load])

    const handleCreate = async () => {
        setSaving(true)
        setError(null)
        try {
            await createStaff(form)
            setShowModal(false)
            setForm(EMPTY_FORM)
            await load()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not create staff member")
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (member: StaffMember) => {
        setBusyId(member.id)
        try {
            const updated = await updateStaff(member.id, { is_active: !member.is_active })
            setStaff((current) => current.map((m) => (m.id === member.id ? updated : m)))
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not update staff member")
        } finally {
            setBusyId(null)
        }
    }

    const changeRole = async (member: StaffMember, role: StaffRole) => {
        setBusyId(member.id)
        try {
            const updated = await updateStaff(member.id, { role })
            setStaff((current) => current.map((m) => (m.id === member.id ? updated : m)))
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not change role")
        } finally {
            setBusyId(null)
        }
    }

    const counts = useMemo(() => {
        const active = staff.filter((m) => m.is_active).length
        return { total: staff.length, active, disabled: staff.length - active }
    }, [staff])

    const roleOptions: StaffRole[] = canCreateAdmin
        ? ["teacher", "analyst", "school_admin", "admin"]
        : ["teacher", "analyst", "school_admin"]

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Staff Management</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Add teachers and staff, manage roles and access.
                    </p>
                </div>
                <button
                    onClick={() => { setForm(EMPTY_FORM); setError(null); setShowModal(true) }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-600"
                >
                    <UserPlus className="h-4 w-4" /> Add Staff
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    <AlertCircle className="h-4 w-4" /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: "Total Staff", value: counts.total, color: "text-slate-900" },
                    { label: "Active", value: counts.active, color: "text-emerald-600" },
                    { label: "Disabled", value: counts.disabled, color: "text-rose-600" },
                ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                        <p className={`mt-2 text-2xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            <section className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setFilter(f.value)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                    filter === f.value ? "bg-cyan-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search staff…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Last Login</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                </td></tr>
                            )}
                            {!loading && staff.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-400">
                                    No staff found.
                                </td></tr>
                            )}
                            {!loading && staff.map((member) => (
                                <tr key={member.id} className="transition-colors hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-xs font-bold text-white">
                                                {(member.full_name || member.username).slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{member.full_name || member.username}</p>
                                                <p className="text-xs font-medium text-slate-500">{member.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {member.id === user?.id ? (
                                            roleBadge(member.role)
                                        ) : (
                                            <select
                                                value={member.role}
                                                disabled={busyId === member.id}
                                                onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500"
                                            >
                                                {(["teacher", "analyst", "school_admin", ...(canCreateAdmin ? ["admin"] : [])] as StaffRole[]).map((r) => (
                                                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {member.is_active ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">Disabled</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                        {member.last_login_at ? new Date(member.last_login_at).toLocaleString() : "Never"}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {member.id !== user?.id ? (
                                            <button
                                                onClick={() => toggleActive(member)}
                                                disabled={busyId === member.id}
                                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                                                    member.is_active
                                                        ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                }`}
                                            >
                                                <Power className="h-3.5 w-3.5" /> {member.is_active ? "Disable" : "Enable"}
                                            </button>
                                        ) : (
                                            <span className="text-xs font-medium text-slate-400">You</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6" onClick={() => setShowModal(false)}>
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900">Add Staff Member</h2>
                            <button onClick={() => setShowModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {([
                                { key: "full_name", label: "Full Name", type: "text", ph: "Jane Doe" },
                                { key: "email", label: "Email", type: "email", ph: "jane@school.edu" },
                                { key: "username", label: "Username", type: "text", ph: "jane.doe" },
                                { key: "password", label: "Password", type: "password", ph: "min 8 characters" },
                            ] as const).map((f) => (
                                <div key={f.key}>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{f.label}</label>
                                    <input
                                        type={f.type}
                                        placeholder={f.ph}
                                        value={form[f.key]}
                                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as StaffRole }))}
                                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500"
                                >
                                    {roleOptions.map((r) => (
                                        <option key={r} value={r}>{ROLE_META[r].label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving || !form.email || !form.username || form.password.length < 8}
                                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Create
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}

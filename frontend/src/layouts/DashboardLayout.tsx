import {useMemo} from "react"
import {NavLink, Outlet, useNavigate} from "react-router-dom"
import {
    Bell,
    BookOpen,
    ChevronDown,
    ClipboardList,
    FileText,
    Home,
    LogOut,
    ScanLine,
    Search,
    Settings,
    Users,
    type LucideIcon
} from "lucide-react"
import {motion} from "framer-motion"
import {useAuth} from "../auth/AuthContext"
import {useAcademic} from "../academic/AcademicContext"

interface NavItem {
    id: string
    label: string
    icon: LucideIcon
    to: string
}

const navItems: NavItem[] = [
    {id: "dashboard", label: "Dashboard", icon: Home, to: "/dashboard"},
    {id: "scans", label: "Scan Queue", icon: ScanLine, to: "/dashboard/scans"},
    {id: "courses", label: "Course Management", icon: BookOpen, to: "/dashboard/courses"},
    {id: "exams", label: "Exam Management", icon: ClipboardList, to: "/dashboard/exams"},
    {id: "reports", label: "Reports", icon: FileText, to: "/dashboard/reports"},
    {id: "students", label: "Students", icon: Users, to: "/dashboard/students"},
    {id: "settings", label: "Settings", icon: Settings, to: "/dashboard/settings"},
]

export function DashboardLayout() {
    const navigate = useNavigate()
    const {user, logout} = useAuth()
    const {isAcademicYearLoading, selectedAcademicYear, academicYearOptions, setSelectedAcademicYear} = useAcademic()

    const initials = useMemo(() => {
        const text = user?.full_name?.trim() || user?.username?.trim() || "User"
        return text
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("")
    }, [user?.full_name, user?.username])

    const onLogout = () => {
        logout()
        navigate("/login", {replace: true})
    }

    return (
        <div
            className="flex h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.08),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] font-sans text-slate-900">
            <aside
                className="flex w-64 shrink-0 flex-col border-r border-slate-200/60 bg-white/60 backdrop-blur-xl transition-all">
                <div className="flex h-20 items-center border-b border-slate-200/60 px-6">
                    <div
                        className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-md shadow-cyan-500/20">
                        <ScanLine className="h-5 w-5"/>
                    </div>
                    <span className="text-xl font-extrabold tracking-tight text-slate-950">OptiMark</span>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        return (
                            <NavLink key={item.id} to={item.to}>
                                {({isActive}) => (
                                    <div
                                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
                                            isActive
                                                ? "border border-cyan-100 bg-cyan-50 text-cyan-700 shadow-sm"
                                                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                                        }`}
                                    >
                                        <Icon className={`h-5 w-5 ${isActive ? "text-cyan-600" : "text-slate-400"}`}/>
                                        <span>{item.label}</span>
                                        {isActive ? <motion.div layoutId="activeNavIndicator"
                                                                className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-500"/> : null}
                                    </div>
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                <div className="border-t border-slate-200/60 p-4">
                    <button
                        type="button"
                        onClick={onLogout}
                        title="Sign out"
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-all hover:bg-slate-100"
                    >
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-sm font-bold text-white shadow-md">
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-slate-950">{user?.full_name ?? user?.username}</p>
                            <p className="truncate text-xs text-slate-500">{user?.role}</p>
                        </div>

                        <LogOut
                            className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-rose-500"/>
                    </button>
                </div>
            </aside>

            <main className="flex h-screen flex-1 flex-col overflow-hidden">
                <header
                    className="z-10 flex h-20 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/40 px-8 backdrop-blur-md">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="Search exams, students, or reports..."
                            className="h-10 w-full rounded-full border border-slate-200 bg-white/80 pl-10 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <label
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
                            <span
                                className="text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</span>
                            <select
                                value={selectedAcademicYear}
                                onChange={(event) => setSelectedAcademicYear(event.target.value)}
                                disabled={isAcademicYearLoading || academicYearOptions.length === 0}
                                className="cursor-pointer bg-transparent pr-1 text-sm font-semibold text-slate-700 focus:outline-none"
                            >
                                {academicYearOptions.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            className="relative cursor-pointer rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                            <Bell className="h-5 w-5"/>
                            <span
                                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-rose-500"/>
                        </button>
                        <button
                            className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                            New Scan
                            <ChevronDown className="h-4 w-4 text-slate-400"/>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <Outlet/>
                </div>
            </main>
        </div>
    )
}

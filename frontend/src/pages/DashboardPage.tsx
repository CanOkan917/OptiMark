import {useEffect, useMemo, useState} from "react"
import {AlertCircle, CheckCircle2, Clock, MoreHorizontal, ScanLine, Users, type LucideIcon} from "lucide-react"
import {motion, type Variants} from "framer-motion"
import {ApiError} from "../api/client"
import {getDashboardSummary} from "../api/dashboard"
import {useAuth} from "../auth/AuthContext"
import type {DashboardSummary} from "../types/auth"

interface StatCard {
    title: string
    value: string
    trend: string
    icon: LucideIcon
    colorClass: string
    bgClass: string
}

interface ActivityItem {
    id: string
    examName: string
    status: "Completed" | "Processing" | "Needs Review"
    scannedCount: number
    time: string
}

const recentActivities: ActivityItem[] = [
    {id: "1", examName: "Midterm: Advanced Physics", status: "Completed", scannedCount: 145, time: "10 mins ago"},
    {id: "2", examName: "Quiz: Intro to Biology", status: "Processing", scannedCount: 82, time: "In progress"},
    {id: "3", examName: "Final: World History", status: "Needs Review", scannedCount: 310, time: "2 hours ago"},
    {id: "4", examName: "Midterm: Calculus I", status: "Completed", scannedCount: 205, time: "Yesterday"},
]

const containerVariants: Variants = {
    hidden: {opacity: 0},
    show: {
        opacity: 1,
        transition: {staggerChildren: 0.15, delayChildren: 0.1},
    },
}

const cardVariants: Variants = {
    hidden: {opacity: 0, y: 20},
    show: {
        opacity: 1,
        y: 0,
        transition: {type: "spring", stiffness: 100, damping: 15},
    },
}

const summaryRoles = new Set(["admin", "school_admin", "analyst"])

export function DashboardPage() {
    const {user} = useAuth()
    const [summary, setSummary] = useState<DashboardSummary | null>(null)
    const [summaryError, setSummaryError] = useState<string | null>(null)
    const canViewSummary = Boolean(user?.role && summaryRoles.has(user.role))

    useEffect(() => {
        if (!canViewSummary) {
            return
        }

        const run = async () => {
            try {
                const data = await getDashboardSummary()
                setSummary(data)
                setSummaryError(null)
            } catch (error) {
                if (error instanceof ApiError && error.status === 403) {
                    setSummaryError("You do not have permission to view summary metrics.")
                    return
                }
                setSummaryError(error instanceof Error ? error.message : "Failed to load summary metrics.")
            }
        }

        void run()
    }, [canViewSummary])

    const stats = useMemo<StatCard[]>(() => {
        return [
            {
                title: "Total Users",
                value: summary ? String(summary.total_users) : "-",
                trend: canViewSummary ? "live summary data" : "summary hidden for this role",
                icon: Users,
                colorClass: "text-cyan-600",
                bgClass: "bg-cyan-100",
            },
            {
                title: "Active Users",
                value: summary ? String(summary.active_users) : "-",
                trend: canViewSummary ? "live summary data" : "summary hidden for this role",
                icon: CheckCircle2,
                colorClass: "text-emerald-600",
                bgClass: "bg-emerald-100",
            },
            {
                title: "Teachers",
                value: summary ? String(summary.teachers) : "-",
                trend: canViewSummary ? "live summary data" : "summary hidden for this role",
                icon: Clock,
                colorClass: "text-amber-600",
                bgClass: "bg-amber-100",
            },
        ]
    }, [canViewSummary, summary])

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Dashboard Overview</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">Welcome back. Here is what&apos;s happening with
                    your workspace today.</p>
                {summaryError ? <p className="mt-2 text-sm text-amber-700">{summaryError}</p> : null}
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="show"
                        className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <motion.div
                            key={stat.title}
                            variants={cardVariants}
                            whileHover={{y: -4, boxShadow: "0 10px 40px -10px rgba(6,182,212,0.15)"}}
                            className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-500">{stat.title}</p>
                                    <h3 className="mt-1 text-3xl font-black text-slate-900">{stat.value}</h3>
                                </div>
                                <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bgClass} ${stat.colorClass}`}>
                                    <Icon className="h-6 w-6"/>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <span
                                    className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">info</span>
                                <span className="text-xs font-medium text-slate-500">{stat.trend}</span>
                            </div>
                        </motion.div>
                    )
                })}
            </motion.div>

            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.4, duration: 0.5}}
                className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
            >
                <div
                    className="flex items-center justify-between border-b border-slate-200/60 bg-slate-50/50 px-6 py-5">
                    <h2 className="text-lg font-black text-slate-900">Recent Exam Processing</h2>
                    <button className="cursor-pointer text-sm font-semibold text-cyan-600 hover:text-cyan-700">View
                        All
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead
                            className="border-b border-slate-100 bg-white text-xs font-semibold uppercase text-slate-500">
                        <tr>
                            <th className="rounded-tl-3xl px-6 py-4">Exam Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Scanned</th>
                            <th className="px-6 py-4">Time</th>
                            <th className="rounded-tr-3xl px-6 py-4 text-right">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {recentActivities.map((activity) => (
                            <tr key={activity.id} className="group transition-colors hover:bg-slate-50/50">
                                <td className="px-6 py-4 font-bold text-slate-900">{activity.examName}</td>
                                <td className="px-6 py-4">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                            activity.status === "Completed"
                                ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                                : activity.status === "Processing"
                                    ? "border border-cyan-100 bg-cyan-50 text-cyan-700"
                                    : "border border-amber-100 bg-amber-50 text-amber-700"
                        }`}
                    >
                      {activity.status === "Completed" ? <CheckCircle2 className="h-3 w-3"/> : null}
                        {activity.status === "Processing" ? (
                            <motion.div animate={{rotate: 360}}
                                        transition={{repeat: Infinity, duration: 2, ease: "linear"}}>
                                <ScanLine className="h-3 w-3"/>
                            </motion.div>
                        ) : null}
                        {activity.status === "Needs Review" ? <AlertCircle className="h-3 w-3"/> : null}
                        {activity.status}
                    </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-600">{activity.scannedCount} sheets</td>
                                <td className="px-6 py-4 text-slate-500">{activity.time}</td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600">
                                        <MoreHorizontal className="h-5 w-5"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    )
}

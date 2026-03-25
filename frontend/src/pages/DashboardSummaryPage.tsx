import {useEffect, useState} from "react"
import {ApiError} from "../api/client"
import {getDashboardSummary} from "../api/dashboard"
import type {DashboardSummary} from "../types/auth"

export function DashboardSummaryPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const run = async () => {
            try {
                const data = await getDashboardSummary()
                setSummary(data)
                setError(null)
            } catch (err) {
                if (err instanceof ApiError && err.status === 403) {
                    setError("You do not have permission to view this page.")
                    return
                }
                setError(err instanceof Error ? err.message : "Failed to fetch summary.")
            }
        }

        void run()
    }, [])

    return (
        <section
            className="mx-auto max-w-6xl rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Summary Details</h1>
            <p className="mt-1 text-sm text-slate-500">Detailed breakdown from `/dashboard/summary`.</p>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

            {summary ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Total Users</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.total_users}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Active Users</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.active_users}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Admins</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.admins}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">School Admins</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.school_admins}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Analysts</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.analysts}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Teachers</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.teachers}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Students</p>
                        <p className="text-2xl font-bold text-slate-900">{summary.students}</p>
                    </article>
                </div>
            ) : null}
        </section>
    )
}

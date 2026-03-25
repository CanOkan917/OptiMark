import { Link } from "react-router-dom"

export function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">403 Forbidden</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">You do not have permission to access this page.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your current role is not authorized for this action. Contact your system administrator if needed.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}

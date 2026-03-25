import {
    ArrowRight,
    Lock,
    Mail,
    ScanLine,
    ShieldCheck,
} from "lucide-react"

function App() {
    return (
        <main
            className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_45%,#ffffff_100%)] text-slate-900">
            <section className="mx-auto w-full max-w-425 px-4 py-5 sm:px-6 md:px-10 lg:px-14 xl:px-16 xl:py-8">
                <div
                    className="grid min-h-[92vh] overflow-hidden rounded-4xl border border-slate-200 bg-white/90 shadow-[0_24px_100px_rgba(15,23,42,0.10)] backdrop-blur xl:grid-cols-[1.2fr_0.8fr]">
                    <div
                        className="relative border-b border-slate-200 p-6 sm:p-8 lg:p-10 xl:border-b-0 xl:border-r xl:p-12">
                        <div
                            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_35%)]"/>

                        <div className="relative z-10">
                            <header className="flex flex-wrap items-center justify-between gap-4">
                                <div className="inline-flex items-center gap-3">
                                    <div
                                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
                                        <ScanLine className="h-5 w-5"/>
                                    </div>
                                    <div>
                                        <p className="text-xl font-extrabold tracking-tight text-slate-950">OptiMark</p>
                                        <p className="text-sm text-slate-500">Dashboard Access Panel</p>
                                    </div>
                                </div>

                                <span
                                    className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  self-hosted
                </span>
                            </header>

                            <div className="mt-10 max-w-3xl">
                                <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 sm:text-sm">
                                    Welcome back
                                </p>

                                <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl xl:text-6xl">
                                    Sign in to your exam operations dashboard.
                                </h1>

                                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                                    Manage scans, verify processing results, and review reports from one secure
                                    workspace.
                                    This instance is already installed and ready to use.
                                </p>

                                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                    <article className="rounded-2xl border border-slate-200 bg-white p-5">
                                        <p className="text-sm text-slate-500">Today's Runs</p>
                                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">128</p>
                                    </article>
                                    <article className="rounded-2xl border border-slate-200 bg-white p-5">
                                        <p className="text-sm text-slate-500">Current Accuracy</p>
                                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">99.1%</p>
                                    </article>
                                    <article className="rounded-2xl border border-slate-200 bg-white p-5">
                                        <p className="text-sm text-slate-500">Queue Status</p>
                                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">Healthy</p>
                                    </article>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50/80 p-6 sm:p-8 lg:p-10 xl:p-12">
                        <div className="mx-auto w-full max-w-130">
                            <div className="mb-6">
                                <div
                                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
                                    <ShieldCheck className="h-4 w-4 text-cyan-600"/>
                                    Secure access
                                </div>

                                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                    Dashboard Login
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                                    Enter your account credentials to continue.
                                </p>
                            </div>

                            <div
                                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:p-8">
                                <form className="space-y-5">
                                    <div>
                                        <label htmlFor="email"
                                               className="mb-2 block text-sm font-semibold text-slate-700">
                                            Email address
                                        </label>
                                        <div className="relative">
                                            <Mail
                                                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                            <input
                                                id="email"
                                                type="email"
                                                placeholder="you@company.com"
                                                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label htmlFor="password"
                                                   className="block text-sm font-semibold text-slate-700">
                                                Password
                                            </label>
                                            <button type="button"
                                                    className="cursor-pointer text-sm font-medium text-cyan-700 transition hover:text-cyan-800">
                                                Forgot password?
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <Lock
                                                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                            <input
                                                id="password"
                                                type="password"
                                                placeholder="Enter your password"
                                                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <label className="inline-flex items-center gap-3 text-sm text-slate-600">
                                            <input type="checkbox"
                                                   className="cursor-pointer h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"/>
                                            Keep me signed in
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        className="cursor-pointer inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 text-sm font-bold text-white transition hover:bg-cyan-600 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                                    >
                                        Sign In
                                        <ArrowRight className="h-4 w-4"/>
                                    </button>
                                </form>

                                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-800">Need access?</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                        Ask your administrator to create your account in the dashboard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}

export default App
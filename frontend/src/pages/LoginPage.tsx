import {
    ArrowRight,
    Lock,
    Mail,
    ScanLine,
    ShieldCheck,
    Upload,
    Cpu,
    FileText,
    type LucideIcon,
} from "lucide-react"
import {motion, type Variants} from "framer-motion"
import {useState, type FormEvent} from "react"
import {Navigate, useLocation, useNavigate} from "react-router-dom"
import {ApiError} from "../api/client"
import {useAuth} from "../auth/AuthContext"

interface ProcessStep {
    number: string
    title: string
    description: string
    icon: LucideIcon
}

const processSteps: ProcessStep[] = [
    {
        number: "01",
        title: "Scan",
        description: "Upload answer sheets or scanned forms in seconds.",
        icon: Upload,
    },
    {
        number: "02",
        title: "Evaluate",
        description: "Automatically detect answers and validate results.",
        icon: Cpu,
    },
    {
        number: "03",
        title: "Report",
        description: "Review outcomes and export clear structured reports.",
        icon: FileText,
    },
]

const containerVariants: Variants = {
    hidden: {opacity: 0},
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.4,
            delayChildren: 0.2,
        },
    },
}

const stepVariants: Variants = {
    hidden: {opacity: 0, y: 40, filter: "blur(8px)"},
    show: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 80,
            damping: 15,
        },
    },
}

const iconVariants: Variants = {
    hidden: {scale: 0, rotate: -45, opacity: 0},
    show: {
        scale: 1,
        rotate: 0,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 200,
            damping: 10,
            delay: 0.1,
        },
    },
}

export function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const {login, isAuthenticated} = useAuth()
    const [usernameOrEmail, setUsernameOrEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace/>
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await login({
                username_or_email: usernameOrEmail.trim(),
                password,
            })

            const targetPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
            navigate(targetPath ?? "/dashboard", {replace: true})
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 401) {
                    setError("Invalid username/email or password.")
                } else if (err.status === 403) {
                    setError("This account is inactive. Please contact an administrator.")
                } else {
                    setError(err.message)
                }
            } else {
                setError("An unexpected error occurred during sign in.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main
            className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_45%,#ffffff_100%)] text-slate-900">
            <section className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 md:px-10 lg:px-14 xl:px-16 xl:py-8">
                <div
                    className="grid min-h-[92vh] overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 shadow-[0_24px_100px_rgba(15,23,42,0.10)] backdrop-blur xl:grid-cols-[1.2fr_0.8fr]">
                    <div
                        className="relative border-b border-slate-200 p-6 sm:p-8 lg:p-10 xl:border-b-0 xl:border-r xl:p-12">
                        <div
                            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_35%)]"/>

                        <div className="relative z-10">
                            <header className="flex flex-wrap items-center justify-between gap-4">
                                <motion.div
                                    initial={{opacity: 0, x: -20}}
                                    animate={{opacity: 1, x: 0}}
                                    transition={{duration: 0.6, ease: "easeOut"}}
                                    className="inline-flex items-center gap-3"
                                >
                                    <div
                                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
                                        <ScanLine className="h-5 w-5"/>
                                    </div>
                                    <div>
                                        <p className="text-xl font-extrabold tracking-tight text-slate-950">OptiMark</p>
                                        <p className="text-sm text-slate-500">Dashboard Access Panel</p>
                                    </div>
                                </motion.div>

                                <motion.span
                                    initial={{opacity: 0, scale: 0.8}}
                                    animate={{opacity: 1, scale: 1}}
                                    transition={{duration: 0.5, delay: 0.2}}
                                    className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                >
                                    self-hosted
                                </motion.span>
                            </header>

                            <div className="mt-10 max-w-4xl">
                                <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}}
                                            transition={{duration: 0.6, delay: 0.3}}>
                                    <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 sm:text-sm">
                                        Welcome back
                                    </p>
                                    <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl xl:text-6xl">
                                        Sign in to your exam operations dashboard.
                                    </h1>
                                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                                        Manage scans, verify processing results, and review reports from one secure
                                        workspace. This instance is already installed and ready to use.
                                    </p>
                                </motion.div>

                                <motion.div variants={containerVariants} initial="hidden" animate="show"
                                            className="mt-12">
                                    <motion.div variants={stepVariants} className="mb-5">
                                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Process</p>
                                        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">A simple
                                            workflow from form to result</h2>
                                    </motion.div>

                                    <div className="relative mt-8">
                                        <motion.div
                                            initial={{scaleX: 0}}
                                            animate={{scaleX: 1}}
                                            transition={{duration: 1.5, ease: "easeInOut", delay: 0.6}}
                                            className="absolute left-0 right-0 top-7 hidden h-[2px] origin-left bg-gradient-to-r from-cyan-100 via-cyan-400 to-cyan-100 sm:block"
                                        />

                                        <motion.div
                                            initial={{scaleY: 0}}
                                            animate={{scaleY: 1}}
                                            transition={{duration: 1.5, ease: "easeInOut", delay: 0.6}}
                                            className="absolute bottom-0 left-[28px] top-0 w-[2px] origin-top bg-gradient-to-b from-cyan-100 via-cyan-400 to-transparent sm:hidden"
                                        />

                                        <div className="grid gap-10 sm:grid-cols-3 sm:gap-6">
                                            {processSteps.map((step, index) => {
                                                const Icon = step.icon
                                                return (
                                                    <motion.div
                                                        key={step.title}
                                                        variants={stepVariants}
                                                        whileHover={{
                                                            y: -8,
                                                            scale: 1.02,
                                                            transition: {type: "spring", stiffness: 300, damping: 20},
                                                        }}
                                                        className="group relative pl-16 sm:pl-0"
                                                    >
                                                        <motion.div variants={iconVariants}
                                                                    className="absolute left-0 top-0 flex sm:left-1/2 sm:-translate-x-1/2">
                                                            <div
                                                                className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200 bg-white shadow-[0_10px_30px_rgba(34,211,238,0.14)] transition-all duration-300 group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                                                                <div
                                                                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-50 to-white opacity-90"/>
                                                                <Icon
                                                                    className="relative z-10 h-6 w-6 text-cyan-600 transition-transform duration-300 group-hover:scale-110"/>
                                                            </div>
                                                        </motion.div>

                                                        <div className="sm:pt-24">
                                                            <div
                                                                className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center">
                                                                <motion.span
                                                                    initial={{opacity: 0, x: -10}}
                                                                    whileInView={{opacity: 1, x: 0}}
                                                                    transition={{delay: 0.5 + index * 0.4}}
                                                                    className="text-xs font-bold tracking-[0.24em] text-cyan-700"
                                                                >
                                                                    {step.number}
                                                                </motion.span>

                                                                <h3 className="text-xl font-black tracking-tight text-slate-950">{step.title}</h3>
                                                            </div>

                                                            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600 sm:mx-auto sm:text-center">{step.description}</p>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-slate-50/80 p-6 sm:p-8 lg:p-10 xl:p-12">
                        <motion.div
                            initial={{opacity: 0, x: 40}}
                            animate={{opacity: 1, x: 0}}
                            transition={{duration: 0.8, delay: 0.4, type: "spring", stiffness: 70}}
                            className="relative z-10 mx-auto w-full max-w-[520px]"
                        >
                            <div className="mb-6">
                                <div
                                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
                                    <ShieldCheck className="h-4 w-4 text-cyan-600"/>
                                    Secure access
                                </div>

                                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Dashboard
                                    Login</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">Enter your account
                                    credentials to continue.</p>
                            </div>

                            <div
                                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] transition-shadow duration-500 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-8">
                                <form className="space-y-5" onSubmit={handleSubmit}>
                                    <div>
                                        <label htmlFor="username"
                                               className="mb-2 block text-sm font-semibold text-slate-700">
                                            Email or Username
                                        </label>
                                        <div className="group relative">
                                            <Mail
                                                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500"/>
                                            <input
                                                id="username"
                                                type="text"
                                                value={usernameOrEmail}
                                                onChange={(event) => setUsernameOrEmail(event.target.value)}
                                                placeholder="you@school.edu"
                                                required
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

                                        <div className="group relative">
                                            <Lock
                                                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500"/>
                                            <input
                                                id="password"
                                                type="password"
                                                value={password}
                                                onChange={(event) => setPassword(event.target.value)}
                                                placeholder="Enter your password"
                                                required
                                                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                            />
                                        </div>
                                    </div>

                                    {error ?
                                        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

                                    <motion.button
                                        whileHover={{scale: 1.02}}
                                        whileTap={{scale: 0.98}}
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 text-sm font-bold text-white transition hover:bg-cyan-600 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-75"
                                    >
                                        {isSubmitting ? "Signing in..." : "Sign In"}
                                        <ArrowRight className="h-4 w-4"/>
                                    </motion.button>
                                </form>

                                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-800">Need access?</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">Ask your administrator to
                                        create your account in the dashboard.</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </main>
    )
}

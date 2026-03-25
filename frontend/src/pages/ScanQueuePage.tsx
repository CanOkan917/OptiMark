import {useState} from "react"
import {
    Upload,
    Search,
    Filter,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileImage,
    PlayCircle
} from "lucide-react"
import {motion} from "framer-motion"

// --- TypeScript Arayüzleri ---
type ScanStatus = "Queued" | "Processing" | "Completed" | "Failed"

interface ScanBatch {
    id: string
    examName: string
    uploadDate: string
    sheetCount: number
    status: ScanStatus
    progress?: number // Sadece Processing durumu için 0-100 arası
}

// --- Sahte Veri (Mock Data) ---
const mockBatches: ScanBatch[] = [
    {
        id: "BCH-8492",
        examName: "Midterm: Calculus I",
        uploadDate: "Today, 14:30",
        sheetCount: 245,
        status: "Processing",
        progress: 68
    },
    {id: "BCH-8493", examName: "Quiz: Intro to Biology", uploadDate: "Today, 15:00", sheetCount: 82, status: "Queued"},
    {
        id: "BCH-8491",
        examName: "Final: Advanced Physics",
        uploadDate: "Today, 11:15",
        sheetCount: 150,
        status: "Completed"
    },
    {
        id: "BCH-8490",
        examName: "Midterm: World History",
        uploadDate: "Yesterday, 09:45",
        sheetCount: 310,
        status: "Failed"
    },
    {
        id: "BCH-8489",
        examName: "Pop Quiz: Chemistry",
        uploadDate: "Yesterday, 08:30",
        sheetCount: 45,
        status: "Completed"
    },
]

export function ScanQueuePage() {
    const [searchTerm, setSearchTerm] = useState("")

    // Duruma göre renk ve ikon döndüren yardımcı fonksiyon
    const getStatusBadge = (status: ScanStatus) => {
        switch (status) {
            case "Completed":
                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5"/> Completed
          </span>
                )
            case "Processing":
                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">
            <motion.div animate={{rotate: 360}} transition={{repeat: Infinity, duration: 2, ease: "linear"}}>
              <PlayCircle className="h-3.5 w-3.5"/>
            </motion.div>
            Processing
          </span>
                )
            case "Queued":
                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            <Clock className="h-3.5 w-3.5"/> Queued
          </span>
                )
            case "Failed":
                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
            <AlertCircle className="h-3.5 w-3.5"/> Failed
          </span>
                )
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">

            {/* Sayfa Başlığı ve Aksiyon Butonu */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Scan Queue</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Manage your uploaded exam sheets and monitor OMR processing status.
                    </p>
                </div>
                <button
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-600 hover:shadow-cyan-500/30 active:scale-95">
                    <Upload className="h-4 w-4"/>
                    Upload New Batch
                </button>
            </div>

            {/* Mini İstatistik Kartları */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    {
                        label: "Currently Processing",
                        value: "245 sheets",
                        color: "text-cyan-600",
                        border: "border-cyan-200/60"
                    },
                    {
                        label: "Waiting in Queue",
                        value: "82 sheets",
                        color: "text-amber-600",
                        border: "border-amber-200/60"
                    },
                    {
                        label: "Processed Today",
                        value: "1,204 sheets",
                        color: "text-emerald-600",
                        border: "border-emerald-200/60"
                    },
                ].map((stat, i) => (
                    <div key={i}
                         className={`rounded-2xl border ${stat.border} bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]`}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
                        <p className={`mt-2 text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Ana Tablo Kartı */}
            <section
                className="rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">

                {/* Tablo Araç Çubuğu (Arama & Filtre) */}
                <div
                    className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="Search batches..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                    </div>
                    <button
                        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                        <Filter className="h-4 w-4 text-slate-400"/>
                        Filter Status
                    </button>
                </div>

                {/* Tablo */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400">
                        <tr className="border-b border-slate-100">
                            <th className="px-6 py-4">Batch Info</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Progress</th>
                            <th className="px-6 py-4">Uploaded</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                        {mockBatches.map((batch) => (
                            <tr key={batch.id} className="transition-colors hover:bg-slate-50/50">

                                {/* Batch Info */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                            <FileImage className="h-5 w-5"/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{batch.examName}</p>
                                            <p className="text-xs font-medium text-slate-500">{batch.id} • {batch.sheetCount} sheets</p>
                                        </div>
                                    </div>
                                </td>

                                {/* Status */}
                                <td className="px-6 py-4">
                                    {getStatusBadge(batch.status)}
                                </td>

                                {/* Progress Bar */}
                                <td className="px-6 py-4 min-w-[150px]">
                                    {batch.status === "Processing" && batch.progress !== undefined ? (
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                                <motion.div
                                                    initial={{width: 0}}
                                                    animate={{width: `${batch.progress}%`}}
                                                    transition={{duration: 1, ease: "easeOut"}}
                                                    className="h-full rounded-full bg-cyan-500"
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-cyan-700">{batch.progress}%</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>

                                {/* Upload Date */}
                                <td className="px-6 py-4 text-slate-500 font-medium">
                                    {batch.uploadDate}
                                </td>

                                {/* Actions */}
                                <td className="px-6 py-4 text-right">
                                    <button
                                        className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900">
                                        <MoreVertical className="h-4 w-4"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination Placeholder */}
                <div
                    className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-center text-xs font-medium text-slate-500">
                    Showing {mockBatches.length} recent batches. View all in history.
                </div>

            </section>
        </div>
    )
}

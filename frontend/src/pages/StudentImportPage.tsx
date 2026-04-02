import {useMemo, useState} from "react"
import {Link} from "react-router-dom"
import {
    ArrowLeft,
    UploadCloud,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Download,
    Info,
    FileSpreadsheet,
    XCircle,
    Clock
} from "lucide-react"
import {useAcademic} from "../academic/AcademicContext"
import {formatDateTime} from "../mocks/students"
import {useStudentsMock} from "../students/StudentsMockContext"
import {ApiError} from "../api/client"

const csvColumns = [
    "student_no",
    "full_name",
    "email",
    "grade_level",
    "group_code",
    "status",
]

const csvSample = [
    "student_no,full_name,email,grade_level,group_code,status",
    "20260015,Deniz Acar,deniz.acar@school.edu,11,11-A,active",
    "20260016,Ege Korkmaz,ege.korkmaz@school.edu,11,11-B,active",
]

export function StudentImportPage() {
    const {selectedAcademicYear} = useAcademic()
    const {importJobs, createImportJob} = useStudentsMock()
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [mockInfo, setMockInfo] = useState<string | null>(null)
    const [mockInfoType, setMockInfoType] = useState<"success" | "error" | null>(null)

    const jobs = useMemo(
        () => [...importJobs]
            .filter((item) => item.academicYear === selectedAcademicYear)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [importJobs, selectedAcademicYear],
    )

    const handleImportClick = async () => {
        if (!selectedFile) {
            setMockInfo("Please select a CSV file first before importing.")
            setMockInfoType("error")
            return
        }
        try {
            const csvContent = await selectedFile.text()
            const result = await createImportJob({
                fileName: selectedFile.name,
                csvContent,
            })
            setMockInfo(
                result.failedCount > 0 && result.errors.length > 0
                    ? `Import completed: ${result.createdCount} created, ${result.updatedCount} updated, ${result.failedCount} failed. First error: ${result.errors[0]}`
                    : `Import completed: ${result.createdCount} created, ${result.updatedCount} updated, ${result.failedCount} failed rows.`,
            )
            setMockInfoType(result.failedCount > 0 ? "error" : "success")
        } catch (error) {
            setMockInfoType("error")
            setMockInfo(
                error instanceof ApiError
                    ? error.message
                    : (error instanceof Error ? error.message : "Import job could not be created."),
            )
        }
    }

    const resetSelection = (e: React.MouseEvent) => {
        e.preventDefault()
        setSelectedFile(null)
        setMockInfo(null)
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">

            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Import Students</h1>
                    <p className="mt-1.5 text-sm font-medium text-slate-500">
                        Upload CSV files to bulk create or update student records for <strong
                        className="text-slate-700">{selectedAcademicYear}</strong>.
                    </p>
                </div>
                <Link
                    to="/dashboard/students"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow-md active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4"/> Back to Directory
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">

                {/* LEFT COLUMN: Upload & Template */}
                <div className="space-y-8">

                    {/* Upload Section */}
                    <section
                        className="overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
                            <h2 className="text-xl font-black text-slate-900">Upload Data</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1">Select a comma-separated values
                                (.csv) file to import.</p>
                        </div>

                        <div className="p-8">
                            {/* Info Box */}
                            <div
                                className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500"/>
                                <div>
                                    <h3 className="text-sm font-bold text-blue-900">Required CSV Columns</h3>
                                    <p className="mt-1 text-xs font-medium text-blue-700 leading-relaxed">
                                        Your file must include the following headers exactly as written: <br/>
                                        <span
                                            className="font-mono font-bold text-blue-800">{csvColumns.join(", ")}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Dropzone */}
                            {!selectedFile ? (
                                <label
                                    className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center transition-all hover:border-cyan-400 hover:bg-cyan-50/50">
                                    <div
                                        className="mb-4 rounded-full bg-white p-4 shadow-sm ring-1 ring-slate-200 group-hover:ring-cyan-300 transition-all">
                                        <UploadCloud
                                            className="h-8 w-8 text-slate-400 group-hover:text-cyan-500 transition-colors"/>
                                    </div>
                                    <span className="text-base font-black text-slate-900">Click to browse or drag file here</span>
                                    <span
                                        className="mt-2 text-sm font-medium text-slate-500">Maximum file size: 10MB</span>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(event) => {
                                            setSelectedFile(event.target.files?.[0] ?? null)
                                            setMockInfo(null)
                                        }}
                                    />
                                </label>
                            ) : (
                                <div
                                    className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 p-5 ring-4 ring-cyan-500/10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                                            <FileSpreadsheet className="h-6 w-6"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{selectedFile?.name}</p>
                                            <p className="text-xs font-semibold text-cyan-700 mt-0.5">Ready to
                                                import</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={resetSelection}
                                        className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-rose-500 transition-colors cursor-pointer"
                                        title="Remove file"
                                    >
                                        <XCircle className="h-6 w-6"/>
                                    </button>
                                </div>
                            )}

                            {/* Status Messages */}
                            {mockInfo && (
                                <div className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
                                    mockInfoType === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                    {mockInfoType === "success" ? <CheckCircle2 className="h-5 w-5"/> :
                                        <AlertTriangle className="h-5 w-5"/>}
                                    {mockInfo}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6">
                                <button
                                    type="button"
                                    onClick={() => void handleImportClick()}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-700 hover:shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95"
                                >
                                    <UploadCloud className="h-5 w-5"/> Start Import Process
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <Download className="h-4 w-4"/> Download Template
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Sample Code Section */}
                    <section
                        className="overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                        <div
                            className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-5">
                            <h2 className="text-lg font-black text-slate-900">Formatting Example</h2>
                            <span
                                className="rounded-full bg-slate-200/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Preview</span>
                        </div>
                        <div className="p-6">
                            <div
                                className="rounded-2xl bg-slate-900 p-5 overflow-hidden ring-1 ring-slate-800 shadow-inner">
                                <div className="mb-3 flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80"></div>
                                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80"></div>
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></div>
                                    <span
                                        className="ml-2 text-[10px] font-bold text-slate-500 font-mono">students_template.csv</span>
                                </div>
                                <pre
                                    className="overflow-x-auto text-xs font-medium leading-loose text-slate-300 font-mono selection:bg-cyan-900">
                                    <span className="text-cyan-400">{csvSample[0]}</span>{"\n"}
                                    {csvSample.slice(1).join("\n")}
                                </pre>
                            </div>
                        </div>
                    </section>
                </div>

                {/* RIGHT COLUMN: History */}
                <div>
                    <section
                        className="sticky top-6 overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
                            <h2 className="text-lg font-black text-slate-900">Recent Import Jobs</h2>
                            <p className="text-xs font-medium text-slate-500 mt-1">History of roster uploads.</p>
                        </div>

                        <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
                            {jobs.map((job) => {
                                const isSuccess = job.status === "completed"
                                const isPartial = job.status === "partial"

                                return (
                                    <div key={job.id}
                                         className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 rounded-full p-1.5 ${
                                                    isSuccess ? "bg-emerald-100 text-emerald-600" :
                                                        isPartial ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                                                }`}>
                                                    <FileText className="h-4 w-4"/>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 line-clamp-1"
                                                       title={job.fileName}>{job.fileName}</p>
                                                    <div
                                                        className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                        <Clock className="h-3 w-3"/>
                                                        {formatDateTime(job.createdAt)}
                                                    </div>
                                                </div>
                                            </div>

                                            <span
                                                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                                    isSuccess ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                                                        isPartial ? "bg-amber-50 text-amber-700 border border-amber-200/60" :
                                                            "bg-rose-50 text-rose-700 border border-rose-200/60"
                                                }`}>
                                                {isSuccess ? <CheckCircle2 className="h-3 w-3"/> :
                                                    <AlertTriangle className="h-3 w-3"/>}
                                                {job.status}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-600">
                                                <span
                                                    className={isSuccess ? "text-emerald-600" : "text-slate-900"}>{job.importedRows}</span> / {job.totalRows} imported
                                            </span>
                                            {job.failedRows > 0 && (
                                                <span className="text-rose-600">{job.failedRows} failed</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {jobs.length === 0 && (
                                <div className="py-12 text-center">
                                    <div
                                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                                        <Clock className="h-6 w-6 text-slate-300"/>
                                    </div>
                                    <p className="text-sm font-bold text-slate-600">No import history found.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

            </div>
        </div>
    )
}

interface DashboardSectionPlaceholderPageProps {
  title: string
  description: string
}

export function DashboardSectionPlaceholderPage({ title, description }: DashboardSectionPlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-6xl rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <p className="mt-4 text-sm text-cyan-700">This page is ready for dedicated content.</p>
    </section>
  )
}

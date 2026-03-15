'use client'
import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { useAgent } from '@/lib/useAgent'

const DynamicChart = dynamic(() => import('@/components/DynamicChart'), { ssr: false })

const SUGGESTED_PROMPTS = [
  'Perbandingan cash in transaction vs angsuran per bulan',
  'Chart doang — komposisi rumah vs makam donut',
  'Tabel data mentah transaksi 6 bulan',
  'Ringkasan keuangan tanpa chart',
  'Lengkap semua — chart, tabel, dan ringkasan',
]

const STEP_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Orchestrator', color: 'text-violet-500' },
  2: { label: 'Finance', color: 'text-emerald-500' },
  3: { label: 'Engineer', color: 'text-blue-500' },
}

type HistoryItem = {
  id: string
  prompt: string
  result: any
  financeData: any
  timestamp: Date
}

function KpiCards({ data }: { data: { label: string; value: string; accent: string }[] }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
      {data.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl border border-[#e8e4de] p-5 shadow-sm">
          <div className="w-0.5 h-8 rounded-full mb-3 float-left mr-3" style={{ backgroundColor: card.accent }} />
          <p className="text-[10px] tracking-wide uppercase text-[#bbb] mb-1">{card.label}</p>
          <p className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ text }: { text: string }) {
  return (
    <div className="bg-[#fffbf0] border border-[#f0e8d0] rounded-2xl p-5">
      <p className="text-[10px] tracking-[0.18em] uppercase text-[#c9a84c] font-semibold mb-2">
        Finance Agent · Ringkasan
      </p>
      <p className="text-sm text-[#666] leading-relaxed">{text}</p>
    </div>
  )
}

function ChartCard({ config, explanation }: { config: any; explanation: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8e4de] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f5f3f0]">
        <p className="text-[10px] tracking-[0.18em] uppercase text-[#bbb] font-semibold mb-0.5">
          Engineer Agent · Visualisasi
        </p>
        <p className="text-sm text-[#777]">{explanation}</p>
      </div>
      <div className="p-6 h-80">
        <DynamicChart config={config} />
      </div>
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8e4de] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f5f3f0]">
        <p className="text-[10px] tracking-[0.18em] uppercase text-[#bbb] font-semibold">Data Mentah</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#f5f3f0]">
              {headers.map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[#bbb] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#faf9f7] hover:bg-[#faf9f7] transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-5 py-3 ${j === 0 ? 'text-[#555] font-medium' : 'text-[#333]'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ComponentRenderer({ component, explanation }: { component: any; explanation: string }) {
  switch (component.type) {
    case 'kpi_cards': return <KpiCards data={component.data} />
    case 'summary': return <SummaryCard text={component.text} />
    case 'chart': return <ChartCard config={component.config} explanation={explanation} />
    case 'table': return <DataTable headers={component.headers} rows={component.rows} />
    default: return null
  }
}

export default function Dashboard() {
  const [prompt, setPrompt] = useState('')
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const prevResultRef = useRef<any>(null)
  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { isLoading, statuses, result, financeData, error, runAgent, rerender, reset } = useAgent()

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return
    reset()
    setActiveFilters({})
    prevResultRef.current = null
    await runAgent(prompt.trim())
  }

  // When new result comes in, save to history
  if (result && result !== prevResultRef.current) {
    prevResultRef.current = result
    const item: HistoryItem = {
      id: Date.now().toString(),
      prompt,
      result,
      financeData,
      timestamp: new Date(),
    }
    setHistory(prev => [item, ...prev.slice(0, 9)])
    setActiveItem(item)
  }

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveItem(item)
    setActiveFilters({})
  }

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...activeFilters, [key]: value }
    setActiveFilters(newFilters)

    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current)
    filterTimeoutRef.current = setTimeout(() => {
      const fd = activeItem?.financeData ?? financeData
      const p = activeItem?.prompt ?? prompt
      if (fd && p) rerender(p, fd, newFilters)
    }, 500)
  }

  const currentResult = activeItem?.result ?? null

  return (
    <main className="min-h-screen bg-[#faf9f7] font-['DM_Sans',sans-serif] text-[#1a1a1a]">

      <header className="bg-white border-b border-[#e8e4de] px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#bbb] font-medium">PropFinance</p>
            <h1 className="text-base font-semibold tracking-tight" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
              AI Dashboard
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#bbb]">
            <span className="w-2 h-2 rounded-full bg-violet-300" />Orchestrator
            <span className="text-[#ddd] mx-1">→</span>
            <span className="w-2 h-2 rounded-full bg-emerald-300" />Finance
            <span className="text-[#ddd] mx-1">→</span>
            <span className="w-2 h-2 rounded-full bg-blue-300" />Engineer
          </div>
        </div>
        <span className="text-[11px] text-[#ccc]">{history.length} analisis</span>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">

        {/* Sidebar */}
        <aside className="w-60 shrink-0">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[#bbb] font-semibold px-1 mb-3">Riwayat</p>
          {history.length === 0 && <p className="text-xs text-[#ccc] px-1">Belum ada analisis</p>}
          <div className="space-y-1.5">
            {history.map(item => (
              <button key={item.id} onClick={() => handleSelectHistory(item)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                  activeItem?.id === item.id
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#666] border-[#eee] hover:border-[#ccc] hover:text-[#333]'
                }`}>
                <p className="font-medium line-clamp-2 leading-snug mb-1">{item.prompt}</p>
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] ${activeItem?.id === item.id ? 'text-[#888]' : 'text-[#ccc]'}`}>
                    {item.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex gap-0.5">
                    {(item.result?.components ?? []).map((c: any) => (
                      <span key={c.type} className={`text-[9px] px-1 py-0.5 rounded font-medium uppercase ${
                        activeItem?.id === item.id ? 'bg-white/10 text-white/60' : 'bg-[#f0ece6] text-[#bbb]'
                      }`}>{c.type[0]}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Prompt */}
          <div className="bg-white rounded-2xl border border-[#e8e4de] p-4 shadow-sm">
            <div className="flex gap-3">
              <input ref={inputRef} type="text" value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Contoh: 'chart doang', 'tabel transaksi', 'lengkap semua'..."
                className="flex-1 bg-[#faf9f7] border border-[#e8e4de] rounded-xl px-4 py-2.5 text-sm text-[#333] placeholder-[#ccc] focus:outline-none focus:border-[#999] transition-colors"
              />
              <button onClick={handleSubmit} disabled={isLoading || !prompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running
                  </span>
                ) : 'Analisis'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTED_PROMPTS.map(s => (
                <button key={s} onClick={() => { setPrompt(s); inputRef.current?.focus() }}
                  className="text-[11px] px-3 py-1 rounded-lg bg-[#f5f3f0] hover:bg-[#ede9e3] text-[#999] hover:text-[#444] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline */}
          {(isLoading || (statuses.length > 0 && !currentResult)) && (
            <div className="bg-white rounded-2xl border border-[#e8e4de] p-4 shadow-sm">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#bbb] font-semibold mb-3">Agent Pipeline</p>
              <div className="space-y-2">
                {statuses.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`text-[10px] font-semibold mt-0.5 w-20 shrink-0 ${STEP_LABELS[s.step]?.color}`}>
                      {STEP_LABELS[s.step]?.label}
                    </span>
                    <span className="text-xs text-[#888]">{s.message}</span>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-1 pt-1 pl-[92px]">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#ddd] animate-bounce"
                        style={{ animationDelay: `${i*150}ms` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">⚠ {error}</div>
          )}

          {/* Result */}
          {currentResult && (
            <div className="space-y-4">

              {/* Dynamic filter bar */}
              {currentResult.filters && currentResult.filters.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#e8e4de] px-5 py-3 shadow-sm flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] tracking-[0.18em] uppercase text-[#bbb] font-semibold shrink-0">
                    Filter
                  </span>
                  {currentResult.filters.map((filter: any) => (
                    <div key={filter.key} className="flex items-center gap-2">
                      <label className="text-xs text-[#aaa]">{filter.label}</label>
                      <select
                        value={activeFilters[filter.key] ?? 'Semua'}
                        onChange={e => handleFilterChange(filter.key, e.target.value)}
                        disabled={isLoading}
                        className="text-xs bg-[#f5f3f0] border border-[#e8e4de] rounded-lg px-3 py-1.5 text-[#444] focus:outline-none focus:border-[#999] disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {filter.options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {isLoading && (
                    <span className="text-[11px] text-[#bbb] flex items-center gap-1.5 ml-auto">
                      <span className="w-2.5 h-2.5 border-2 border-[#ccc] border-t-[#999] rounded-full animate-spin" />
                      Re-rendering...
                    </span>
                  )}
                </div>
              )}

              {/* Dumb renderer */}
              {currentResult.components?.map((component: any, i: number) => (
                <ComponentRenderer
                  key={i}
                  component={component}
                  explanation={currentResult.explanation}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !currentResult && !error && (
            <div className="bg-white rounded-2xl border border-[#e8e4de] p-20 text-center shadow-sm">
              <p className="text-5xl mb-4">📊</p>
              <p className="text-sm text-[#ccc]">Masukkan prompt untuk memulai analisis</p>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
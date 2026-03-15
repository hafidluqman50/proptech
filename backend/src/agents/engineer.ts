import Anthropic from '@anthropic-ai/sdk'
import type { FinanceResult } from './finance'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type FilterOption = {
  key: string
  label: string
  options: string[]
}

export type Component =
  | { type: 'kpi_cards'; data: { label: string; value: string; accent: string }[] }
  | { type: 'summary'; text: string }
  | { type: 'chart'; config: object }
  | { type: 'table'; headers: string[]; rows: (string | number)[][] }

export type EngineerResult = {
  explanation: string
  filters: FilterOption[]
  components: Component[]
}

export async function engineerAgent(
  prompt: string,
  financeResult: FinanceResult,
  onStatus: (msg: string) => void
): Promise<EngineerResult> {
  onStatus('Engineer Agent: generating visualization...')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `You are a frontend engineer for a property company financial dashboard.
Decide WHAT components to render and generate their full data/config.
Also decide what filter options are relevant for the user to refine the view.

AVAILABLE COMPONENT TYPES:
1. "kpi_cards" — metric cards. Always include. Min 2, max 4 cards.
2. "summary" — financial summary text in Indonesian
3. "chart" — Chart.js v4 visualization
4. "table" — data table with pre-formatted string values

DECISION RULES:
- "chart doang" → [kpi_cards, chart]
- "tabel" → [kpi_cards, table]
- "ringkasan" → [kpi_cards, summary]
- "chart dan tabel" → [kpi_cards, chart, table]
- default / "lengkap" → [kpi_cards, summary, chart, table]

FILTER RULES:
- Always generate relevant filter options based on the data and prompt
- Common filters: periode (months available in data), unit_type (if relevant)
- Options must include "Semua" as first option
- Only generate filters that make sense for the current view

STRICT RULES:
- Return ONLY valid JSON, no markdown
- chart: ONLY types bar, line, pie, doughnut
- chart colors: rgba format only
- NEVER mention other chart libraries
- All labels/text in Indonesian
- table rows: pre-formatted strings (e.g. "Rp 3,69 M" not raw numbers)
- kpi_cards values: formatted strings

Response format (pure JSON):
{
  "explanation": "Max 2 sentences in Indonesian",
  "filters": [
    {
      "key": "periode",
      "label": "Periode",
      "options": ["Semua", "Jan 2024", "Feb 2024"]
    }
  ],
  "components": [
    {
      "type": "kpi_cards",
      "data": [
        { "label": "Total Transaksi", "value": "Rp 3,69 M", "accent": "#7c3aed" }
      ]
    },
    {
      "type": "summary",
      "text": "Ringkasan..."
    },
    {
      "type": "chart",
      "config": {
        "type": "doughnut",
        "data": { "labels": [], "datasets": [] },
        "options": { "responsive": true, "maintainAspectRatio": false }
      }
    },
    {
      "type": "table",
      "headers": ["Bulan", "Cash In Transaction", "Cash In Real"],
      "rows": [["Jan 2024", "Rp 467 jt", "Rp 22 jt"]]
    }
  ]
}`,
    messages: [{
      role: 'user',
      content: `User request: "${prompt}"

Financial data:
${JSON.stringify(financeResult.data, null, 2)}

Finance summary: ${financeResult.summary}

Meta:
- Total Cash In Transaction: ${financeResult.meta.totalTransaction}
- Total Cash In Real: ${financeResult.meta.totalInstallment}
- Period: ${financeResult.meta.period}

Generate components and filters accordingly.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const match = raw.match(/\{[\s\S]*\}/)

  try {
    const parsed = JSON.parse(match?.[0] ?? '{}') as EngineerResult
    if (!parsed.components || parsed.components.length === 0) throw new Error('No components')
    if (!parsed.filters) parsed.filters = []
    return parsed
  } catch {
    return {
      explanation: 'Perbandingan cash in transaction dan angsuran per bulan.',
      filters: [
        {
          key: 'unit_type',
          label: 'Tipe Unit',
          options: ['Semua', 'Rumah', 'Makam']
        }
      ],
      components: [
        {
          type: 'kpi_cards',
          data: [
            { label: 'Cash In Transaction', value: `Rp ${(financeResult.meta.totalTransaction / 1_000_000_000).toFixed(2)} M`, accent: '#7c3aed' },
            { label: 'Cash In Real', value: `Rp ${(financeResult.meta.totalInstallment / 1_000_000).toFixed(0)} jt`, accent: '#059669' },
            { label: 'Periode', value: financeResult.meta.period, accent: '#d97706' },
          ]
        },
        {
          type: 'chart',
          config: {
            type: 'bar',
            data: {
              labels: financeResult.data.labels,
              datasets: [
                { label: 'Cash In Transaction', data: financeResult.data.cashInTransaction, backgroundColor: 'rgba(99,102,241,0.8)' },
                { label: 'Cash In Real', data: financeResult.data.cashInReal, backgroundColor: 'rgba(16,185,129,0.8)' }
              ]
            },
            options: { responsive: true, maintainAspectRatio: false }
          }
        }
      ]
    }
  }
}
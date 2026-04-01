import Anthropic from '@anthropic-ai/sdk'
import { financeAgent } from './finance'
import { engineerAgent } from './engineer'
import type { FinanceResult } from './finance'
import type { EngineerResult } from './engineer'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type AgentResult = {
  explanation: string
  filters: EngineerResult['filters']
  components: EngineerResult['components']
  financeResult: FinanceResult
}

const tools: Anthropic.Tool[] = [
  {
    name: 'query_finance',
    description: 'Query financial transaction and installment data from the database. Always call this first to get data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateRange: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Start date YYYY-MM-DD' },
            to: { type: 'string', description: 'End date YYYY-MM-DD' }
          }
        },
        unitType: {
          type: 'string',
          enum: ['rumah', 'makam', 'all'],
          description: 'Filter by unit type'
        },
        dataType: {
          type: 'string',
          enum: ['transaction', 'installment', 'both'],
          description: 'Type of financial data to query'
        }
      }
    }
  },
  {
    name: 'render_dashboard',
    description: 'Generate visual dashboard components (KPI cards, charts, tables) from financial data. Only call this if the user wants visual output like charts or tables.',
    input_schema: {
      type: 'object' as const,
      properties: {
        financeData: {
          type: 'object',
          description: 'The financial data returned from query_finance'
        }
      },
      required: ['financeData']
    }
  }
]

export async function runAgent(
  prompt: string,
  onStatus: (msg: string, step: number) => void,
  onFinance: (result: FinanceResult) => void
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt }
  ]

  let financeResult: FinanceResult | null = null
  let engineerResult: EngineerResult | null = null

  onStatus('Agent: analyzing prompt...', 1)

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are an AI assistant for a property company financial dashboard.
Use the tools available to fulfill the user's request.
- Always call query_finance first to fetch data.
- Call render_dashboard only if the user wants charts, tables, or visual output.
- If the user only wants numbers or a text summary, skip render_dashboard.`,
      tools,
      messages
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        if (block.name === 'query_finance') {
          onStatus('Finance Agent: querying database...', 2)
          const input = block.input as { dateRange?: { from: string; to: string }; unitType?: 'rumah' | 'makam' | 'all'; dataType?: 'transaction' | 'installment' | 'both' }
          financeResult = await financeAgent(
            prompt,
            { intent: prompt, route: ['finance', 'engineer'], filters: input },
            (msg) => onStatus(msg, 2)
          )
          onFinance(financeResult)
          onStatus('Finance Agent: done.', 2)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(financeResult)
          })
        }

        if (block.name === 'render_dashboard') {
          onStatus('Engineer Agent: generating visualization...', 3)
          const input = block.input as { financeData: FinanceResult }
          engineerResult = await engineerAgent(
            prompt,
            input.financeData ?? financeResult!,
            (msg) => onStatus(msg, 3)
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(engineerResult)
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }

  if (engineerResult) {
    return {
      explanation: engineerResult.explanation,
      filters: engineerResult.filters,
      components: engineerResult.components,
      financeResult: financeResult!
    }
  }

  return {
    explanation: financeResult!.summary,
    filters: [],
    components: [
      {
        type: 'kpi_cards',
        data: [
          { label: 'Total Transaksi', value: `Rp ${(financeResult!.meta.totalTransaction / 1_000_000_000).toFixed(2)} M`, accent: '#7c3aed' },
          { label: 'Total Angsuran', value: `Rp ${(financeResult!.meta.totalInstallment / 1_000_000).toFixed(0)} jt`, accent: '#059669' },
          { label: 'Periode', value: financeResult!.meta.period, accent: '#d97706' },
        ]
      },
      { type: 'summary', text: financeResult!.summary }
    ],
    financeResult: financeResult!
  }
}

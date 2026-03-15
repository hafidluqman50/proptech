import Anthropic from '@anthropic-ai/sdk'
import sql from '../db/client'
import type { OrchestratorResult } from './orchestrator'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type FinanceResult = {
  summary: string
  data: {
    labels: string[]
    cashInTransaction: number[]
    cashInReal: number[]
    byUnitType?: {
      rumah: number[]
      makam: number[]
    }
  }
  meta: {
    totalTransaction: number
    totalInstallment: number
    period: string
  }
}

async function queryData(filters: OrchestratorResult['filters']) {
  const unitFilter = filters.unitType && filters.unitType !== 'all'
    ? sql` AND unit_type = ${filters.unitType}`
    : sql``

  const dateFilter = filters.dateRange
    ? sql` AND date BETWEEN ${filters.dateRange.from} AND ${filters.dateRange.to}`
    : sql``

  // Always query both tables regardless of dataType filter
  const transactionRows = await sql`
    SELECT 
      TO_CHAR(date, 'YYYY-MM') as month,
      unit_type,
      SUM(amount) as total
    FROM transactions
    WHERE 1=1 ${unitFilter} ${dateFilter}
    GROUP BY month, unit_type
    ORDER BY month
  `

  const installmentRows = await sql`
    SELECT 
      month,
      SUM(amount) as total
    FROM installments
    WHERE 1=1 ${dateFilter}
    GROUP BY month
    ORDER BY month
  `

  return { transactionRows, installmentRows }
}

export async function financeAgent(
  prompt: string,
  orchestratorResult: OrchestratorResult,
  onStatus: (msg: string) => void
): Promise<FinanceResult> {
  onStatus('Finance Agent: querying database...')

  const { transactionRows, installmentRows } = await queryData(orchestratorResult.filters)

  console.log('Filters:', JSON.stringify(orchestratorResult.filters))
  console.log('transactionRows:', transactionRows.length)
  console.log('installmentRows:', installmentRows.length)

  // Collect all unique months
  const allMonths = [...new Set([
    ...transactionRows.map((r: any) => String(r.month)),
    ...installmentRows.map((r: any) => String(r.month))
  ])].sort()

  const labels = allMonths

  const cashInTransaction = allMonths.map(month =>
    transactionRows
      .filter((r: any) => String(r.month) === month)
      .reduce((sum: number, r: any) => sum + Number(r.total), 0)
  )

  const cashInReal = allMonths.map(month => {
    const row = installmentRows.find((r: any) => String(r.month) === month)
    return row ? Number(row.total) : 0
  })

  const byUnitType = {
    rumah: allMonths.map(month =>
      transactionRows
        .filter((r: any) => String(r.month) === month && r.unit_type === 'rumah')
        .reduce((sum: number, r: any) => sum + Number(r.total), 0)
    ),
    makam: allMonths.map(month =>
      transactionRows
        .filter((r: any) => String(r.month) === month && r.unit_type === 'makam')
        .reduce((sum: number, r: any) => sum + Number(r.total), 0)
    )
  }

  const totalTransaction = cashInTransaction.reduce((a, b) => a + b, 0)
  const totalInstallment = cashInReal.reduce((a, b) => a + b, 0)

  onStatus('Finance Agent: analyzing data...')

  const summaryResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: `You are a financial analyst for a property company selling houses (rumah) and burial plots (makam).
Write a brief 2-sentence financial summary in Indonesian based on the data provided.
Be specific with numbers. Format large numbers as "Rp X,X M" (miliar) or "Rp X jt" (juta).`,
    messages: [{
      role: 'user',
      content: `User request: ${prompt}
Data:
- Total Cash In Transaction: Rp ${(totalTransaction / 1_000_000_000).toFixed(2)} M
- Total Cash In Real (Angsuran): Rp ${(totalInstallment / 1_000_000).toFixed(0)} jt
- Period: ${labels[0]} to ${labels[labels.length - 1]}
- Monthly breakdown transactions: ${JSON.stringify(cashInTransaction)}
- Monthly breakdown installments: ${JSON.stringify(cashInReal)}`
    }]
  })

  const summary = summaryResponse.content[0].type === 'text'
    ? summaryResponse.content[0].text
    : ''

  return {
    summary,
    data: { labels, cashInTransaction, cashInReal, byUnitType },
    meta: {
      totalTransaction,
      totalInstallment,
      period: labels.length > 0 ? `${labels[0]} - ${labels[labels.length - 1]}` : '-'
    }
  }
}
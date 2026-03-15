import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { engineerAgent } from './agents/engineer'
import type { FinanceResult } from './agents/finance'
import { financeAgent } from './agents/finance'
import { orchestratorAgent } from './agents/orchestrator'

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))

  .get('/', () => ({ status: 'ok' }))

  // Full pipeline
  .post('/agent/analyze', async ({ body }) => {
    const { prompt } = body as { prompt: string }
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          ))
        }

        try {
          send('status', { message: 'Orchestrator: analyzing prompt...', step: 1 })
          const orchestratorResult = await orchestratorAgent(prompt)
          send('status', { message: 'Orchestrator: routing to Finance Agent...', step: 1 })

          send('status', { message: 'Finance Agent: querying database...', step: 2 })
          const financeResult = await financeAgent(
            prompt,
            orchestratorResult,
            (msg) => send('status', { message: msg, step: 2 })
          )
          // Send finance data so frontend can cache it
          send('finance', { result: financeResult })
          send('status', { message: 'Finance Agent: done. Passing to Engineer Agent...', step: 2 })

          send('status', { message: 'Engineer Agent: generating visualization...', step: 3 })
          const engineerResult = await engineerAgent(
            prompt,
            financeResult,
            (msg) => send('status', { message: msg, step: 3 })
          )

          send('done', {
            explanation: engineerResult.explanation,
            filters: engineerResult.filters,
            components: engineerResult.components,
          })

        } catch (err: any) {
          send('error', { message: err.message || 'Something went wrong' })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  })

  // Engineer only — for filter re-renders
  .post('/agent/rerender', async ({ body }) => {
    const { prompt, financeData, filters } = body as {
      prompt: string
      financeData: FinanceResult
      filters: Record<string, string>
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          ))
        }

        try {
          send('status', { message: 'Engineer Agent: re-rendering with filters...', step: 3 })

          const activeFilters = Object.entries(filters)
            .filter(([_, v]) => v !== 'Semua' && v !== 'all')
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')

          const filteredPrompt = activeFilters
            ? `${prompt}. Filter aktif: ${activeFilters}`
            : prompt

          const engineerResult = await engineerAgent(
            filteredPrompt,
            financeData,
            (msg) => send('status', { message: msg, step: 3 })
          )

          send('done', {
            explanation: engineerResult.explanation,
            filters: engineerResult.filters,
            components: engineerResult.components,
          })

        } catch (err: any) {
          send('error', { message: err.message })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  })

  .listen(3001)

console.log('🚀 Proptech API running on http://localhost:3001')
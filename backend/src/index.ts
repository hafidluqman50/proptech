import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { runAgent } from './agents/agent'
import { engineerAgent } from './agents/engineer'
import type { FinanceResult } from './agents/finance'

const app = new Elysia()
  .use(cors({ origin: process.env.APP_URL }))

  .get('/', () => ({ status: 'ok' }))

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
          const result = await runAgent(
            prompt,
            (msg, step) => send('status', { message: msg, step }),
            (financeResult) => send('finance', { result: financeResult })
          )

          send('done', {
            explanation: result.explanation,
            filters: result.filters,
            components: result.components,
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

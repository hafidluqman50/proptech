'use client'
import { useCallback, useState } from 'react'

export type AgentStatus = {
  message: string
  step: number
}

export type UseAgentReturn = {
  isLoading: boolean
  statuses: AgentStatus[]
  result: any | null
  financeData: any | null
  error: string | null
  runAgent: (prompt: string) => Promise<void>
  rerender: (prompt: string, financeData: any, filters: Record<string, string>) => Promise<void>
  reset: () => void
}

async function readSSEStream(
  response: Response,
  onStatus: (s: AgentStatus) => void,
  onFinance: (data: any) => void,
  onDone: (data: any) => void,
  onError: (msg: string) => void
) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const messages = buffer.split('\n\n')
    buffer = messages.pop() ?? ''

    for (const message of messages) {
      if (!message.trim()) continue
      const lines = message.split('\n')
      let eventName = ''
      let eventData = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim()
        else if (line.startsWith('data: ')) eventData = line.slice(6).trim()
      }

      if (!eventName || !eventData) continue

      try {
        const parsed = JSON.parse(eventData)
        if (eventName === 'status') onStatus(parsed)
        if (eventName === 'finance') onFinance(parsed.result)
        if (eventName === 'done') onDone(parsed)
        if (eventName === 'error') onError(parsed.message)
      } catch {}
    }
  }
}

export function useAgent(): UseAgentReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [statuses, setStatuses] = useState<AgentStatus[]>([])
  const [result, setResult] = useState<any | null>(null)
  const [financeData, setFinanceData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatuses([])
    setResult(null)
    setError(null)
  }, [])

  const runAgent = useCallback(async (prompt: string) => {
    setIsLoading(true)
    reset()

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agent/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        }
      )

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
      if (!response.body) throw new Error('No response body')

      await readSSEStream(
        response,
        (s) => setStatuses(prev => [...prev, s]),
        (data) => setFinanceData(data),
        (data) => setResult(data),
        (msg) => setError(msg)
      )
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [reset])

  const rerender = useCallback(async (
    prompt: string,
    financeData: any,
    filters: Record<string, string>
  ) => {
    setIsLoading(true)
    setStatuses([])
    setError(null)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agent/rerender`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, financeData, filters })
        }
      )

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
      if (!response.body) throw new Error('No response body')

      await readSSEStream(
        response,
        (s) => setStatuses(prev => [...prev, s]),
        () => {}, // no finance update on rerender
        (data) => setResult(data),
        (msg) => setError(msg)
      )
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, statuses, result, financeData, error, runAgent, rerender, reset }
}
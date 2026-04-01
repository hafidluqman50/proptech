import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type OrchestratorResult = {
  intent: string
  route: ('finance' | 'engineer')[]
  filters: {
    dateRange?: { from: string; to: string }
    unitType?: 'rumah' | 'makam' | 'all'
    dataType?: 'transaction' | 'installment' | 'both'
  }
}

export async function orchestratorAgent(prompt: string): Promise<OrchestratorResult> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are an orchestrator for a property company financial dashboard.
Analyze the user prompt and decide which agents to call.

ROUTING RULES:
- Always include "finance" in route.
- Include "engineer" if the user wants a chart, table, or visual dashboard.
- Omit "engineer" if the user only wants a number, summary text, or simple answer.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "intent": "brief description of what user wants",
  "route": ["finance"] or ["finance", "engineer"],
  "filters": {
    "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } or null,
    "unitType": "rumah" | "makam" | "all",
    "dataType": "transaction" | "installment" | "both"
  }
}`,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as OrchestratorResult
}

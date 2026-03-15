# PropFinance AI — Multi-Agent Financial Dashboard

Stack: **Bun + Elysia + Next.js + Tailwind + Chart.js + PostgreSQL + Anthropic**

## Architecture

```
User Prompt
    ↓
[Orchestrator]  claude-haiku   → parse intent, extract filters
    ↓
[Finance Agent] claude-sonnet  → query postgres, summarize data
    ↓
[Engineer Agent] claude-sonnet → generate Chart.js config (strictly)
    ↓
Frontend SSE stream → render chart dinamis
```

## Prerequisites

- Bun >= 1.0
- PostgreSQL running locally
- Anthropic API key

---

## Setup Backend

```bash
cd backend

# Install dependencies
bun install

# Copy env
cp .env.example .env

# Edit .env:
# DATABASE_URL=postgres://user:password@localhost:5432/proptech
# ANTHROPIC_API_KEY=sk-ant-...

# Create DB (if not exists)
createdb proptech

# Seed dummy data (6 bulan transaksi property rumah + makam)
bun run db:seed

# Run dev server (port 3001)
bun run dev
```

---

## Setup Frontend

```bash
cd frontend

# Install dependencies
bun install

# Run dev server (port 3000)
bun run dev
```

Open http://localhost:3000

---

## How SSE Works (manual, no SDK)

```
Elysia pushes:          Frontend reads:
                        reader.read() loop
event: status           → update status list
data: {"message":"..."}

event: done             → set result, render chart
data: {"chartConfig":{}}

\n\n  ← message separator
```

See `frontend/src/lib/useAgent.ts` for the full manual implementation.

---

## Agent Flow Detail

### 1. Orchestrator (Haiku — cheap)
- Parses natural language prompt
- Extracts: intent, dateRange, unitType, dataType
- Routes to Finance Agent

### 2. Finance Agent (Sonnet)
- Builds SQL query based on orchestrator filters
- Queries `transactions` and `installments` tables
- Returns structured data + financial summary in Indonesian

### 3. Engineer Agent (Sonnet)
- Receives structured financial data
- Generates valid Chart.js v4 config
- **Strictly Chart.js only** — type whitelist: bar, line, pie, doughnut
- Returns `{ chartConfig, explanation }`

---

## Database Schema

```sql
transactions (
  id, date, customer_name,
  unit_type  -- 'rumah' | 'makam'
  amount, type  -- 'akad' | 'dp'
)

installments (
  id, date, customer_name,
  amount, month  -- 'YYYY-MM'
)
```

---

## Example Prompts

- "Tampilkan perbandingan cash in transaction vs angsuran per bulan"
- "Berapa total penjualan rumah vs makam tahun ini?"
- "Trend pendapatan 6 bulan terakhir dalam bentuk line chart"
- "Komposisi cash in transaction berdasarkan tipe unit"

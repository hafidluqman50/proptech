import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

export async function setupDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      unit_type VARCHAR(10) NOT NULL CHECK (unit_type IN ('rumah', 'makam')),
      amount BIGINT NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('akad', 'dp'))
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS installments (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      amount BIGINT NOT NULL,
      month VARCHAR(7) NOT NULL
    )
  `
  console.log('✓ Tables created')
}

export async function seedDb() {
  await setupDb()

  // Clear existing
  await sql`TRUNCATE transactions, installments RESTART IDENTITY`

  // Seed transactions (cash in transaction - akad & dp)
  const customers = ['Budi Santoso', 'Siti Rahma', 'Ahmad Fauzi', 'Dewi Lestari', 'Hendra Wijaya',
    'Rina Susanti', 'Doni Kurniawan', 'Maya Putri', 'Fajar Nugroho', 'Lina Marlina']

  const transactionData = []
  for (let month = 1; month <= 6; month++) {
    const count = Math.floor(Math.random() * 3) + 2
    for (let i = 0; i < count; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const unitType = Math.random() > 0.3 ? 'rumah' : 'makam'
      const type = Math.random() > 0.4 ? 'akad' : 'dp'
      const amount = unitType === 'rumah'
        ? (type === 'akad' ? (300_000_000 + Math.floor(Math.random() * 200_000_000)) : (50_000_000 + Math.floor(Math.random() * 50_000_000)))
        : (type === 'akad' ? (20_000_000 + Math.floor(Math.random() * 15_000_000)) : (5_000_000 + Math.floor(Math.random() * 5_000_000)))

      transactionData.push({
        date: `2024-${String(month).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        customer_name: customer,
        unit_type: unitType,
        amount,
        type
      })
    }
  }

  for (const t of transactionData) {
    await sql`INSERT INTO transactions ${sql(t)}`
  }

  // Seed installments (cash in real - angsuran bulanan)
  const installmentCustomers = customers.slice(0, 7)
  for (let month = 1; month <= 6; month++) {
    for (const customer of installmentCustomers) {
      if (Math.random() > 0.2) { // 80% chance bayar tiap bulan
        const amount = 2_000_000 + Math.floor(Math.random() * 3_000_000)
        await sql`INSERT INTO installments ${sql({
          date: `2024-${String(month).padStart(2, '0')}-05`,
          customer_name: customer,
          amount,
          month: `2024-${String(month).padStart(2, '0')}`
        })}`
      }
    }
  }

  console.log('✓ Seed data inserted')
  await sql.end()
}

seedDb().catch(console.error)

// Bradesco Bank CSV format:
// Semicolon separator, date DD/MM/YYYY
// Columns: Data;Histórico;Valor;Saldo
// Positive Valor = credit, negative Valor = debit

import type { ParsedRow } from '../csv.parser'

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

function parseBRL(value: string): number {
  return parseFloat(value.trim().replace(/\./g, '').replace(',', '.'))
}

function parseDateBR(value: string): string {
  const [d, m, y] = value.trim().split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseBradescoBank(content: string): ParsedRow[] {
  const lines = content.split('\n').map((l) => l.trim().replace(/\r$/, ''))
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line) continue
    const cols = line.split(';')
    if (cols.length < 3) continue

    const rawDate = cols[0].trim()
    if (!DATE_RE.test(rawDate)) continue

    const description = cols[1].trim()
    const rawValue = cols[2].trim()

    if (!description || !rawValue) continue

    const value = parseBRL(rawValue)
    if (isNaN(value)) continue

    rows.push({
      date: parseDateBR(rawDate),
      description,
      amount: Math.abs(value),
      type: value >= 0 ? 'credit' : 'debit',
    })
  }

  return rows
}

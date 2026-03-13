// Itaú Bank CSV format:
// Semicolon separator, no header row — positional columns
// [0]=Data (DD/MM/YYYY), [1]=Descrição, [2]=Valor (Brazilian format, signed)
// Negative valor = debit (saída), positive = credit (entrada)
// Encoding handled upstream by detectAndDecode — parser receives clean string

import type { ParsedRow } from '../csv.parser'

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

function parseDateBR(value: string): string {
  const [d, m, y] = value.trim().split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseBRL(value: string): number {
  // "-385,00" → -385.00 | "4.828,95" → 4828.95
  return parseFloat(value.trim().replace(/\./g, '').replace(',', '.'))
}

export function parseItauBank(content: string): ParsedRow[] {
  const lines = content.split('\n').map((l) => l.trim().replace(/\r$/, ''))
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line) continue
    const cols = line.split(';')
    if (cols.length < 3) continue

    const rawDate = cols[0].trim()
    if (!DATE_RE.test(rawDate)) continue // skips any malformed or unexpected rows

    const description = cols[1].trim()
    const rawValue = cols[2].trim()

    if (!description || !rawValue) continue

    const value = parseBRL(rawValue)
    if (isNaN(value) || value === 0) continue

    rows.push({
      date: parseDateBR(rawDate),
      description,
      amount: Math.abs(value),
      type: value < 0 ? 'debit' : 'credit',
    })
  }

  return rows
}

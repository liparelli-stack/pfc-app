// Itaú Card CSV format:
// Comma separator, date YYYY-MM-DD (no conversion needed)
// Columns: data,lançamento,valor
// Positive valor = expense (debit), negative = reversal/estorno (credit)
// Encoding handled upstream by detectAndDecode — parser receives clean string

import type { ParsedRow } from '../csv.parser'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseItauCard(content: string): ParsedRow[] {
  const lines = content.split('\n').map((l) => l.trim().replace(/\r$/, ''))
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line) continue
    const cols = line.split(',')
    if (cols.length < 3) continue

    const rawDate = cols[0].trim()
    if (!DATE_RE.test(rawDate)) continue // skips header and metadata rows

    // lançamento may contain commas — last column is always valor
    const rawValue = cols[cols.length - 1].trim()
    const description = cols.slice(1, cols.length - 1).join(',').trim()

    if (!description || !rawValue) continue

    const value = parseFloat(rawValue)
    if (isNaN(value) || value === 0) continue

    rows.push({
      date: rawDate,
      description,
      amount: Math.abs(value),
      type: value >= 0 ? 'debit' : 'credit',
    })
  }

  return rows
}

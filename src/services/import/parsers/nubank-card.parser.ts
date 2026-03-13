// Nubank Card CSV format:
// Comma separator, date YYYY-MM-DD
// Columns: date,title,amount
// Positive amount = debit (spending)
// Negative amount = credit (Pagamento recebido, estorno)
// Title may contain installment suffix like "Mercadinho - 1/3"

import type { ParsedRow } from '../csv.parser'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Matches installment suffix: "- 1/3", "– 2/5", " 1/3" at end of title
const INSTALLMENT_RE = /\s*[-–]?\s*(\d+)\s*\/\s*(\d+)\s*$/

function parseTitle(raw: string): string {
  const match = INSTALLMENT_RE.exec(raw)
  if (match) {
    const base = raw.slice(0, match.index).trim()
    const current = match[1]
    const total = match[2]
    return `${base} (${current}/${total})`
  }
  return raw.trim()
}

export function parseNubankCard(content: string): ParsedRow[] {
  const lines = content.split('\n').map((l) => l.trim().replace(/\r$/, ''))
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line) continue
    const cols = line.split(',')
    if (cols.length < 3) continue

    const rawDate = cols[0].trim()
    if (!DATE_RE.test(rawDate)) continue

    // title may contain commas — everything between first and last column
    const rawAmount = cols[cols.length - 1].trim()
    const rawTitle = cols.slice(1, cols.length - 1).join(',').trim()

    if (!rawTitle || !rawAmount) continue

    const amount = parseFloat(rawAmount)
    if (isNaN(amount)) continue

    const description = parseTitle(rawTitle)

    rows.push({
      date: rawDate,
      description,
      amount: Math.abs(amount),
      type: amount >= 0 ? 'debit' : 'credit',
    })
  }

  return rows
}

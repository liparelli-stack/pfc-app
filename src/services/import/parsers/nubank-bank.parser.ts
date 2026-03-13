// Nubank Bank (Conta) CSV format:
// Comma separator, date DD/MM/YYYY, encoding UTF-8
// Columns: Data,Valor,Identificador,Descrição
// Negative Valor = debit (saída), Positive = credit (entrada)
// Identificador is a UUID unique per transaction — used directly as import_hash

import type { ParsedRow } from '../csv.parser'

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
const UUID_RE = /^[0-9a-f-]{36}$/i

function parseDateBR(value: string): string {
  const [d, m, y] = value.trim().split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseNubankBank(content: string): ParsedRow[] {
  const lines = content.split('\n').map((l) => l.trim().replace(/\r$/, ''))
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line) continue
    const cols = line.split(',')
    if (cols.length < 4) continue

    const rawDate = cols[0].trim()
    if (!DATE_RE.test(rawDate)) continue // skips header and metadata rows

    const rawValue = cols[1].trim()
    const identifier = cols[2].trim()
    // description may contain commas — rejoin remaining columns
    const description = cols.slice(3).join(',').trim()

    if (!rawValue || !description) continue
    if (!UUID_RE.test(identifier)) continue // skip rows without a valid identifier

    const value = parseFloat(rawValue)
    if (isNaN(value) || value === 0) continue

    rows.push({
      date: parseDateBR(rawDate),
      description,
      amount: Math.abs(value),
      type: value < 0 ? 'debit' : 'credit',
      import_hash: identifier, // UUID used directly — guaranteed unique by Nubank
    })
  }

  return rows
}

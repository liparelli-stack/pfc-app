import { parseItauBank } from './parsers/itau-bank.parser'
import { parseItauCard } from './parsers/itau-card.parser'
import { parseNubankBank } from './parsers/nubank-bank.parser'
import { parseNubankCard } from './parsers/nubank-card.parser'
import { parseBradescoBank } from './parsers/bradesco-bank.parser'

// Shape that every parser must return
export interface ParsedRow {
  date: string          // YYYY-MM-DD
  description: string
  amount: number        // always positive
  type: 'debit' | 'credit'
  import_hash?: string  // optional: parsers may supply their own unique ID (e.g. Nubank UUID)
}

// Final normalized shape stored in DB
export interface NormalizedTransaction extends ParsedRow {
  origin_id: string
  origin_type: 'bank' | 'card'
  import_hash: string
}

// ─── Encoding detection ───────────────────────────────────────────────────────

// Common mojibake patterns for Portuguese text when Windows-1252 bytes are
// incorrectly decoded as UTF-8 (e.g. "Ã©" instead of "é", "Ã§" instead of "ç")
const MOJIBAKE_RE = /Ã©|Ã§|Ã£|Ãµ|Ãª|Ã­|Ã³|Ãº|Ã‡|Ã"|â€™|â€œ|â€/

/**
 * Reads a File and returns its text content with automatic encoding detection.
 * Tries strict UTF-8 first; falls back to Windows-1252 (Excel legacy exports)
 * if the bytes are invalid UTF-8 or produce recognizable mojibake patterns.
 */
export async function detectAndDecode(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  try {
    // fatal:true throws a TypeError on any invalid UTF-8 byte sequence
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Extra guard: valid UTF-8 bytes but content looks like mojibake
    if (MOJIBAKE_RE.test(text)) {
      return new TextDecoder('windows-1252').decode(bytes)
    }
    return text
  } catch {
    // Invalid UTF-8 — most likely a Windows-1252 file exported by Excel
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

// FNV-1a 32-bit hash — deterministic, collision-resistant for deduplication
function fnv1a(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (Math.imul(hash, 0x01000193)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function computeHash(date: string, description: string, amount: number): string {
  return fnv1a(`${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`)
}

// Known name aliases for each institution (case-insensitive partial match)
const ITAU_KEYS = ['itaú', 'itau', 'personnalité', 'personalite', 'uniclass', 'iupp', 'iti']
const NUBANK_KEYS = ['nubank', 'roxinho', 'ultravioleta', 'nu conta', 'nu cartão', 'nuconta']
const BRADESCO_KEYS = ['bradesco', 'next', 'bbc']

function matchesAny(name: string, keywords: string[]): boolean {
  return keywords.some((k) => name.includes(k))
}

function isNubank(name: string): boolean {
  // Also match bare "nu" as a full word at start or standalone
  return matchesAny(name, NUBANK_KEYS) || name === 'nu' || name.startsWith('nu ')
}

function detectParser(
  sourceType: 'bank' | 'card',
  sourceName: string,
): ((content: string) => ParsedRow[]) {
  const name = sourceName.toLowerCase().trim()

  if (matchesAny(name, ITAU_KEYS)) {
    return sourceType === 'bank' ? parseItauBank : parseItauCard
  }
  if (isNubank(name)) {
    return sourceType === 'bank' ? parseNubankBank : parseNubankCard
  }
  if (matchesAny(name, BRADESCO_KEYS)) {
    if (sourceType === 'card') throw new Error('Parser para cartão Bradesco ainda não implementado.')
    return parseBradescoBank
  }

  throw new Error(
    `Nenhum parser disponível para "${sourceName}". Bancos suportados: Itaú, Nubank, Bradesco.`,
  )
}

export function parseCSV(
  content: string,
  sourceType: 'bank' | 'card',
  originId: string,
  sourceName: string,
): NormalizedTransaction[] {
  const parser = detectParser(sourceType, sourceName)
  const rows = parser(content)

  return rows.map((row) => ({
    ...row,
    origin_id: originId,
    origin_type: sourceType,
    // Use parser-supplied hash (e.g. Nubank UUID) when available, otherwise compute
    import_hash: row.import_hash ?? computeHash(row.date, row.description, row.amount),
  }))
}

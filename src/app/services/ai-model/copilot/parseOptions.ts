export interface ParsedOption {
  label?: string
  content: string
  confidence?: number
}

/** Remove ```json ... ``` style code fences that models like to add. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()
}

/** Heuristic: does this look like a raw JSON payload? */
export function looksLikeJson(text: string): boolean {
  const t = text.trim()
  return (
    (t.startsWith('[') || t.startsWith('{')) &&
    /"(label|content|id|type|confidence)"\s*:/.test(t)
  )
}

/**
 * Primary format — a quote-free, line-delimited block format.
 *
 * LLMs routinely emit JSON with unescaped double quotes inside Vietnamese text
 * (e.g. `"content": "khi bạn nói "thêm chỉ báo"...`), which makes JSON.parse
 * throw and previously dumped raw JSON into the UI. This format cannot break
 * that way because no escaping is involved.
 *
 * ```
 * @@@
 * LABEL: <nhãn ngắn>
 * CONFIDENCE: 95
 * CONTENT: <nội dung đầy đủ>
 * ```
 */
export function parseDelimitedOptions(text: string): ParsedOption[] {
  const cleaned = stripCodeFences(text)
  const blocks = cleaned
    .split(/^[ \t]*@@@[ \t]*$/m)
    .map((b) => b.trim())
    .filter(Boolean)

  const out: ParsedOption[] = []
  for (const block of blocks) {
    const content = readField(block, 'CONTENT')
    if (!content) continue
    const label = readField(block, 'LABEL') || undefined
    const rawConf = readField(block, 'CONFIDENCE')
    const conf = rawConf ? parseInt(rawConf.replace(/[^\d]/g, ''), 10) : NaN
    out.push({
      label,
      content,
      confidence: Number.isFinite(conf) ? conf : undefined,
    })
  }
  return out
}

/**
 * Read a `FIELD:` value. The value may span multiple lines and ends at the next
 * ALL-CAPS field header (`LABEL:`, `CONTENT:`, ...), so regular prose that
 * happens to contain a colon does not terminate it.
 */
function readField(block: string, name: string): string | null {
  const re = new RegExp(`^${name}[ \\t]*:[ \\t]*([\\s\\S]*?)(?=^[A-Z_]+[ \\t]*:|$)`, 'm')
  const m = block.match(re)
  if (!m) return null
  const value = m[1].trim()
  return value || null
}

/** A well-formed JSON array of options, if the model went that way anyway. */
export function tryParseJsonOptions(text: string): ParsedOption[] | null {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(cleaned.substring(start, end + 1))
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.map((item) => ({
      label: typeof item?.label === 'string' ? item.label : undefined,
      content: typeof item?.content === 'string' ? item.content : '',
      confidence: typeof item?.confidence === 'number' ? item.confidence : undefined,
    }))
  } catch {
    return null
  }
}

/**
 * Last-resort rescue for JSON that has *unescaped* quotes inside string values.
 *
 * Matching each field up to the following field's KEY (rather than up to the
 * next quote) tolerates embedded `"` characters, which is exactly the failure
 * mode observed with Groq/Llama output.
 */
export function salvageJsonOptions(text: string): ParsedOption[] {
  const cleaned = stripCodeFences(text)
  const out: ParsedOption[] = []

  // content ... "confidence": — the terminator is the field key, not a bare quote.
  const withConfidence =
    /"label"\s*:\s*"([\s\S]*?)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*,\s*"confidence"\s*:\s*(\d{1,3})/g
  let m: RegExpExecArray | null
  while ((m = withConfidence.exec(cleaned))) {
    out.push({ label: m[1].trim(), content: m[2].trim(), confidence: Number(m[3]) })
  }
  if (out.length > 0) return out

  // Fallback ordering: content before label, or confidence absent.
  const loose = /"content"\s*:\s*"([\s\S]*?)"\s*[,}]/g
  while ((m = loose.exec(cleaned))) {
    const content = m[1].trim()
    if (content) out.push({ content })
  }
  return out
}

/**
 * Full parsing chain: delimited format → JSON → malformed-JSON rescue.
 * Returns `null` when nothing usable could be extracted.
 */
export function parseOptionResponse(text: string): ParsedOption[] | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const delimited = parseDelimitedOptions(trimmed)
  if (delimited.length > 0) return delimited

  const json = tryParseJsonOptions(trimmed)
  if (json) return json.filter((o) => o.content)

  const salvaged = salvageJsonOptions(trimmed)
  if (salvaged.length > 0) return salvaged

  return null
}

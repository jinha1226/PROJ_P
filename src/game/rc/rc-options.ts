// Minimal RC (init.txt) option editor. Treats the file as newline-separated
// lines; manages a single `key = value` line, preserving everything else and
// ignoring commented (#...) lines. Matches `key` as the first token before `=`.
function isAssignmentTo(line: string, key: string): boolean {
  const m = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line)
  return m !== null && m[1] === key
}

export function getRcOption(text: string, key: string): string | null {
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('#')) continue
    if (isAssignmentTo(line, key)) {
      const eq = line.indexOf('=')
      return line.slice(eq + 1).trim()
    }
  }
  return null
}

export function setRcOption(text: string, key: string, value: string | null): string {
  const lines = text.split('\n')
  // Track a trailing empty element from a final newline so we can restore it.
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === ''
  if (hadTrailingNewline) lines.pop()

  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    const managed = !line.trimStart().startsWith('#') && isAssignmentTo(line, key)
    if (managed) {
      if (value === null) continue // drop the line
      out.push(`${key} = ${value}`)
      replaced = true
    } else {
      out.push(line)
    }
  }
  if (value !== null && !replaced) out.push(`${key} = ${value}`)

  let result = out.join('\n')
  // Re-add a trailing newline if the input had one, or if we appended to
  // non-empty content (so managed lines always end cleanly).
  if (out.length > 0) result += '\n'
  return result
}

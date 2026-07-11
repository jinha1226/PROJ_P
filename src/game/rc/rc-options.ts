// Minimal RC (init.txt) option editor. Treats the file as newline-separated
// lines; manages a single `key = value` line, preserving everything else and
// ignoring commented (#...) lines. Matches `key` as the first token before `=`.

export interface RcControls {
  available(): boolean
  request(): void
  getOption(key: string): string | null
  setOption(key: string, value: string | null): void
  onChange(cb: () => void): void
}
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

// Managed comment lines: `# pocketzot:<key> <value>`. DCSS ignores comments
// entirely (no unknown-option warning) and the option editor above skips
// them, so this is a safe side-channel for client-only state — e.g. the
// custom touch layout backed up for incognito sessions.
function commentPrefix(key: string): string {
  return `# pocketzot:${key} `
}

export function getRcComment(text: string, key: string): string | null {
  const prefix = commentPrefix(key)
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith(prefix)) return t.slice(prefix.length).trim()
  }
  return null
}

export function setRcComment(text: string, key: string, value: string | null): string {
  const prefix = commentPrefix(key)
  const lines = text.split('\n')
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === ''
  if (hadTrailingNewline) lines.pop()

  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    if (line.trim().startsWith(prefix)) {
      if (value === null) continue
      out.push(prefix + value)
      replaced = true
    } else {
      out.push(line)
    }
  }
  if (value !== null && !replaced) out.push(prefix + value)

  let result = out.join('\n')
  if (out.length > 0) result += '\n'
  return result
}

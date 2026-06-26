// Skill-preset logic: parse the rendered skill menu into rows, and compute the
// toggles needed to make exactly a saved name-set the trained skills. Pure and
// DOM-free so it's unit-testable; game-view wires it to the CRT text, the RC
// store, and the keystroke send path.
//
// A skill row is `<letter> <sign> <name…>` with sign ∈ + (training) / - (off) /
// * (focused) — see skill-hotkeys.ts for the shared anchor. We additionally
// capture the sign and the name. The name runs to the first 2+-space column gap
// so a translated name with a single internal space ("원거리 무기") stays whole
// while the numeric level/aptitude columns are excluded. The leading
// (?<=^|\s) anchor (zero-width) keeps us off digits inside those columns.

export interface SkillRow {
  letter: string
  state: '+' | '-' | '*'
  name: string
}

const ROW_RE = /(?<=^|\s)([a-z0-9]) ([+\-*]) (\S.*?)(?=\s{2,}|$)/g

export function parseSkillRows(lines: Iterable<string>): SkillRow[] {
  const rows: SkillRow[] = []
  const seen = new Set<string>()
  for (const text of lines) {
    for (const m of text.matchAll(ROW_RE)) {
      const letter = m[1]
      if (seen.has(letter)) continue  // one row per hotkey (2-column dedupe)
      seen.add(letter)
      rows.push({ letter, state: m[2] as SkillRow['state'], name: m[3].trim() })
    }
  }
  return rows
}

// `|` never appears in a DCSS skill name, so it's a safe join/split delimiter
// for the single RC line we persist the preset in.
export const PRESET_DELIM = '|'

export function presetToRc(names: readonly string[]): string {
  return names.join(PRESET_DELIM)
}

export function rcToPreset(value: string | null): string[] {
  if (!value) return []
  return value.split(PRESET_DELIM).map(s => s.trim()).filter(Boolean)
}

// A skill is "on" when training (+) or focused (*); only - is off.
function isOn(state: SkillRow['state']): boolean {
  return state !== '-'
}

// Names of the skills currently being trained — what Save persists.
export function trainedNames(rows: readonly SkillRow[]): string[] {
  return rows.filter(r => isOn(r.state)).map(r => r.name)
}

// The hotkey letters whose training state must flip so that exactly the preset
// names end up on. Skills already in the desired state are skipped; lowercase
// letter sends toggle train on/off in the DCSS skill menu.
export function computeSkillToggles(rows: readonly SkillRow[], preset: readonly string[]): string[] {
  const want = new Set(preset)
  const out: string[] = []
  for (const r of rows) {
    if (isOn(r.state) !== want.has(r.name)) out.push(r.letter)
  }
  return out
}

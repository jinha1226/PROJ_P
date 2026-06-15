// Parse the on-screen hotkeys from a rendered DCSS skill menu (CRT lines).
//
// Each selectable skill row carries `X S Name…` — a hotkey letter/digit, a
// training sign (+, -, *), then the skill name. The name is NOT required to
// start with a capital: under client-side translation it is Hangul (전투 기술),
// so we only require a non-space after the sign. The hotkey prefix must begin
// at the line start or after whitespace (a zero-width lookbehind, so match
// .index still points at the hotkey letter — skill-reflow.ts relies on that),
// which keeps us from false-matching the digits inside the level/cost/target
// columns. The single-space spacing (`X␠S␠`) is what rules out the aptitude
// column's "+5 +4" style runs.
//
// Exported so skill-reflow.ts shares the exact same row anchor — the reflow's
// column split and this parser must agree on what a skill row looks like.
// Global (for matchAll); derive a non-global copy via `new RegExp(.source)` for
// any single `.test()` call, since a global regex is stateful under `.test()`.
export const SKILL_HOTKEY_RE = /(?<=^|\s)([a-z0-9]) [+\-*] (?=\S)/g

export function extractSkillHotkeys(lines: Iterable<string>): string[] {
  const seen = new Set<string>()
  for (const text of lines) {
    for (const m of text.matchAll(SKILL_HOTKEY_RE)) seen.add(m[1])
  }
  const order = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return [...order].filter(c => seen.has(c))
}

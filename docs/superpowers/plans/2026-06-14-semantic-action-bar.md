# Semantic Action Bar + KO/EN Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the touch HUD's raw-key button labels (`o`, `5`, `z`…) with newbie-friendly semantic labels ("자동탐색 / Explore"), switchable between Korean and English with a toggle.

**Architecture:** PocketZot's `src/game/input/touch.ts` already defines on-screen controls as `TAB_BUTTONS` rows of `{ label, title, text|key }`, where `title` is an English description. We add a pure label-lookup module keyed by `title`, persist a `uiLang` preference, and have `renderContent` display the semantic label instead of the raw key. A small toggle button flips the language and re-renders. No game logic changes; this is presentation only. (Pillar 1, tile-touch travel, is a separate later plan.)

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom for DOM tests). Test runner: `npx vitest run`.

**Scope note:** This plan keeps PocketZot's existing 3 tabs (`@`/`>`/`?`) and only relabels. Tab reorganization and tile-touch travel are out of scope.

---

## File Structure

- **Create** `src/game/input/action-labels.ts` — pure module: `UiLang` use, the KO/EN label table keyed by English `title`, `actionLabel()` lookup, and `TAB_LABELS` for the tab names. No DOM. One responsibility: map an action to its display label.
- **Create** `src/game/input/action-labels.test.ts` — unit tests for the lookup + coverage (every `TAB_BUTTONS` title has a label).
- **Create** `src/game/input/touch-labels.test.ts` — happy-dom test that the rendered HUD shows semantic labels and the toggle flips language.
- **Modify** `src/prefs.ts` — add `uiLang: UiLang` (default `'ko'`).
- **Modify** `src/game/input/touch.ts` — export `TAB_BUTTONS`; render semantic labels; add the language toggle button + semantic tab labels; re-render on toggle.
- **Modify** `src/style.css` — styling for word (non-glyph) buttons and the toggle.

---

### Task 1: Preference field `uiLang`

**Files:**
- Modify: `src/prefs.ts`

- [ ] **Step 1: Add the `UiLang` type and the `uiLang` pref**

In `src/prefs.ts`, add the exported type above `interface Prefs`, then add the field to `Prefs` and `DEFAULTS`:

```ts
export type UiLang = 'ko' | 'en'

export interface Prefs {
  lastGuestSpectateWsUrl: string | null
  monsterListCollapsed: boolean
  mapRenderMode: 'ascii' | 'tiles'
  uiLang: UiLang
}

const DEFAULTS: Prefs = {
  lastGuestSpectateWsUrl: null,
  monsterListCollapsed: false,
  mapRenderMode: 'ascii',
  uiLang: 'ko',
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/prefs.ts
git commit -m "feat(prefs): add uiLang preference (default ko)"
```

---

### Task 2: Action-label lookup module

**Files:**
- Create: `src/game/input/action-labels.ts`
- Test: `src/game/input/action-labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/input/action-labels.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { actionLabel, ACTION_LABELS, TAB_LABELS } from './action-labels'
import { TAB_BUTTONS } from './touch'

describe('actionLabel', () => {
  it('returns the Korean label for a known title', () => {
    const r = actionLabel({ label: 'o', title: 'Auto-explore' }, 'ko')
    expect(r).toEqual({ text: '자동탐색', named: true })
  })

  it('returns the English label for a known title', () => {
    const r = actionLabel({ label: 'o', title: 'Auto-explore' }, 'en')
    expect(r).toEqual({ text: 'Explore', named: true })
  })

  it('falls back to the raw label when title is unknown', () => {
    const r = actionLabel({ label: '☠', title: 'Mystery command' }, 'ko')
    expect(r).toEqual({ text: '☠', named: false })
  })

  it('falls back to the raw label when there is no title', () => {
    const r = actionLabel({ label: 'Z' }, 'en')
    expect(r).toEqual({ text: 'Z', named: false })
  })
})

describe('label coverage', () => {
  it('every TAB_BUTTONS title has a KO and EN label', () => {
    const missing: string[] = []
    for (const rows of Object.values(TAB_BUTTONS)) {
      for (const row of rows) {
        for (const def of row) {
          if (!def.title) continue
          const pair = ACTION_LABELS[def.title]
          if (!pair || !pair.ko || !pair.en) missing.push(def.title)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('every tab has a KO and EN label', () => {
    for (const key of ['micro', 'macro', 'info', 'spells'] as const) {
      expect(TAB_LABELS[key].ko.length).toBeGreaterThan(0)
      expect(TAB_LABELS[key].en.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/input/action-labels.test.ts`
Expected: FAIL — `action-labels` module and `TAB_BUTTONS` export do not exist yet.

- [ ] **Step 3: Create the module**

Create `src/game/input/action-labels.ts`:

```ts
import type { UiLang } from '../../prefs'

export interface LabelPair { ko: string; en: string }

// Keyed by the English `title` string used in touch.ts TAB_BUTTONS. Labels are
// kept short so they fit a touch button; the full `title` remains the tooltip.
export const ACTION_LABELS: Record<string, LabelPair> = {
  // micro
  'Auto-fight nearest':   { ko: '자동전투', en: 'Fight' },
  'Rest until healed':    { ko: '휴식',     en: 'Rest' },
  'Inventory':            { ko: '소지품',   en: 'Items' },
  'Auto-explore':         { ko: '자동탐색', en: 'Explore' },
  'Quaff potion':         { ko: '물약',     en: 'Quaff' },
  'Read scroll':          { ko: '두루마리', en: 'Read' },
  'Fire / quivered':      { ko: '발사',     en: 'Fire' },
  'Evoke item':           { ko: '발동',     en: 'Evoke' },
  'Use ability':          { ko: '능력',     en: 'Ability' },
  'Cast spell':           { ko: '주문',     en: 'Cast' },
  'Examine surroundings': { ko: '둘러보기', en: 'Look' },
  'Pick up item':         { ko: '줍기',     en: 'Pick up' },
  // macro
  'Wield weapon':              { ko: '무기',     en: 'Wield' },
  'Remove jewellery':          { ko: '장신구해제', en: 'Remove' },
  'Tell allies (tt to shout)': { ko: '명령',     en: 'Tell' },
  'Put on jewellery':          { ko: '장신구',   en: 'Put on' },
  'Drop':                      { ko: '버리기',   en: 'Drop' },
  'Find feature (Ctrl+F)':     { ko: '지형찾기', en: 'Find' },
  'Go to level / branch':      { ko: '원거리이동', en: 'Travel' },
  'Dungeon overview (Ctrl+O)': { ko: '던전개요', en: 'Overview' },
  'Examine level map':         { ko: '지도',     en: 'Map' },
  'Equip / exclude':           { ko: '장착',     en: 'Equip' },
  'Ascend stairs':             { ko: '계단↑',   en: 'Up' },
  'Descend stairs':            { ko: '계단↓',   en: 'Down' },
  // info
  'Character status':                  { ko: '상태',     en: 'Status' },
  'Character overview':                { ko: '캐릭터',   en: 'Character' },
  'Religion / deity':                  { ko: '신앙',     en: 'Religion' },
  'Reassign inventory/spell letters':  { ko: '글자정리', en: 'Reassign' },
  'Abilities/mutations':               { ko: '능력·변이', en: 'Abilities' },
  'Skills screen':                     { ko: '기술',     en: 'Skills' },
  'Runes collected':                   { ko: '룬',       en: 'Runes' },
  'Item knowledge':                    { ko: '아이템지식', en: 'Known' },
  'Gold / shopping list':              { ko: '소지금',   en: 'Gold' },
  'Spell library':                     { ko: '주문서고', en: 'Library' },
  'List memorised spells':             { ko: '암기주문', en: 'Spells' },
  'Help':                              { ko: '도움말',   en: 'Help' },
}

export const TAB_LABELS: Record<'micro' | 'macro' | 'info' | 'spells', LabelPair> = {
  micro:  { ko: '행동', en: 'Act' },
  macro:  { ko: '운영', en: 'More' },
  info:   { ko: '정보', en: 'Info' },
  spells: { ko: '주문', en: 'Spells' },
}

// Returns the display text and whether it is a semantic (word) label. When the
// action is unknown, falls back to the raw key glyph so nothing breaks.
export function actionLabel(
  def: { label: string; title?: string },
  lang: UiLang,
): { text: string; named: boolean } {
  const pair = def.title ? ACTION_LABELS[def.title] : undefined
  if (!pair) return { text: def.label, named: false }
  return { text: pair[lang], named: true }
}
```

- [ ] **Step 4: Export `TAB_BUTTONS` from touch.ts**

In `src/game/input/touch.ts`, change the declaration (line ~73) from `const TAB_BUTTONS` to `export const TAB_BUTTONS`:

```ts
export const TAB_BUTTONS: Record<Exclude<TabKey, 'spells'>, TabButtonDef[][]> = {
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/game/input/action-labels.test.ts`
Expected: PASS (all cases, including coverage).

- [ ] **Step 6: Commit**

```bash
git add src/game/input/action-labels.ts src/game/input/action-labels.test.ts src/game/input/touch.ts
git commit -m "feat(input): KO/EN action-label lookup keyed by command title"
```

---

### Task 3: Render semantic labels in the touch HUD

**Files:**
- Modify: `src/game/input/touch.ts`
- Test: `src/game/input/touch-labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/input/touch-labels.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'

beforeEach(() => {
  localStorage.clear()
})

function labels(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.tc-content .tc-btn')].map(b => b.textContent ?? '')
}

describe('semantic labels in the touch HUD', () => {
  it('renders Korean action labels by default (uiLang default ko)', () => {
    const tc = buildTouchControls(() => {})
    const texts = labels(tc.element)
    expect(texts).toContain('자동탐색') // Auto-explore
    expect(texts).toContain('휴식')     // Rest
    expect(texts).not.toContain('o')    // raw key no longer shown
  })

  it('named buttons get the "named" class for text styling', () => {
    const tc = buildTouchControls(() => {})
    const explore = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '자동탐색')!
    expect(explore.classList.contains('named')).toBe(true)
  })

  it('still sends the original key when a semantic button is tapped', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const explore = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '자동탐색') as HTMLButtonElement
    explore.click()
    expect(sent).toContainEqual({ msg: 'input', text: 'o' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/input/touch-labels.test.ts`
Expected: FAIL — buttons still show raw `def.label` (`o`), so `자동탐색` is not found.

- [ ] **Step 3: Wire the lookup into `renderContent`**

In `src/game/input/touch.ts`, add imports near the top (after the existing imports, around line 11). **Import only what this task uses** — `tsconfig` has `noUnusedLocals: true`, so `setPref`/`TAB_LABELS` are added later in Task 4, not now:

```ts
import { getPref } from '../../prefs'
import { actionLabel } from './action-labels'
import type { UiLang } from '../../prefs'
```

Inside `buildTouchControls`, add a language closure variable next to `let activeTab` (around line 416):

```ts
  let lang: UiLang = getPref('uiLang')
```

Replace the body of `renderContent` (around lines 644-667) so the displayed text uses the semantic label and tags named buttons:

```ts
  function renderContent(rows: TabButtonDef[][]): void {
    contentEl.innerHTML = ''
    for (const row of rows) {
      const rowEl = document.createElement('div')
      rowEl.className = 'tc-row'
      for (const def of row) {
        if (!def.label) {
          const spacer = document.createElement('div')
          spacer.className = 'tc-btn tc-btn-spacer'
          rowEl.appendChild(spacer)
          continue
        }
        const btn = document.createElement('button')
        btn.className = 'tc-btn'
        const { text, named } = actionLabel(def, lang)
        if (named) btn.classList.add('named')
        else if (/[^\x20-\x7e]/.test(def.label)) btn.classList.add('glyph')
        btn.textContent = text
        if (def.title) { btn.title = def.title; btn.setAttribute('aria-label', def.title) }
        btn.addEventListener('touchstart', e => { e.preventDefault(); sendTabKey(def) }, { passive: false })
        btn.addEventListener('click', () => sendTabKey(def))
        rowEl.appendChild(btn)
      }
      contentEl.appendChild(rowEl)
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/game/input/touch-labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + type-check (no regressions)**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (existing touch/keyboard/monster tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-labels.test.ts
git commit -m "feat(input): show semantic action labels in the touch HUD"
```

---

### Task 4: Language toggle button + semantic tab labels

**Files:**
- Modify: `src/game/input/touch.ts`
- Test: `src/game/input/touch-labels.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/game/input/touch-labels.test.ts`:

```ts
describe('language toggle', () => {
  it('flips labels KO -> EN when the toggle is tapped', () => {
    const tc = buildTouchControls(() => {})
    const toggle = tc.element.querySelector('.tc-lang') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    toggle.click()
    const texts = [...tc.element.querySelectorAll('.tc-content .tc-btn')].map(b => b.textContent)
    expect(texts).toContain('Explore')
    expect(texts).not.toContain('자동탐색')
  })

  it('persists the chosen language to prefs', () => {
    const tc = buildTouchControls(() => {})
    const toggle = tc.element.querySelector('.tc-lang') as HTMLButtonElement
    toggle.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"uiLang":"en"')
  })

  it('shows semantic tab names', () => {
    const tc = buildTouchControls(() => {})
    const tabTexts = [...tc.element.querySelectorAll('.tc-tab')].map(b => b.textContent)
    expect(tabTexts).toContain('행동') // micro
    expect(tabTexts).toContain('정보') // info
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/game/input/touch-labels.test.ts`
Expected: FAIL — no `.tc-lang` element, tabs still show `@`/`?`.

- [ ] **Step 3: Extend the imports for this task**

In `src/game/input/touch.ts`, update the two import lines added in Task 3 to also bring in `setPref` and `TAB_LABELS` (now used by the toggle and tab labels):

```ts
import { getPref, setPref } from '../../prefs'
import { actionLabel, TAB_LABELS } from './action-labels'
```

- [ ] **Step 4: Use semantic tab labels at tab creation**

In `src/game/input/touch.ts`, the tab definitions (around lines 519-524) currently use glyph labels. Replace the `tabDefs` block so labels come from `TAB_LABELS` in the current language:

```ts
  const tabDefs: { key: TabKey; label: string }[] = [{ key: 'micro', label: TAB_LABELS.micro[lang] }]
  if (opts.spellTab) tabDefs.push({ key: 'spells', label: TAB_LABELS.spells[lang] })
  tabDefs.push({ key: 'macro', label: TAB_LABELS.macro[lang] }, { key: 'info', label: TAB_LABELS.info[lang] })
```

- [ ] **Step 5: Add the toggle button and re-render logic**

In `src/game/input/touch.ts`, add the toggle button to the footer. After the `kbdBtn` is appended to `footerEl` (around line 593), insert:

```ts
  const langBtn = document.createElement('button')
  langBtn.className = 'tc-lang'
  langBtn.title = 'Language / 언어'
  function syncLangBtn(): void { langBtn.textContent = lang === 'ko' ? '한' : 'EN' }
  function updateTabLabels(): void {
    tabsEl.querySelectorAll<HTMLElement>('.tc-tab').forEach(el => {
      const key = el.dataset.tab as TabKey | undefined
      if (key && key in TAB_LABELS) el.textContent = TAB_LABELS[key as keyof typeof TAB_LABELS][lang]
    })
  }
  function toggleLang(): void {
    lang = lang === 'ko' ? 'en' : 'ko'
    setPref('uiLang', lang)
    syncLangBtn()
    updateTabLabels()
    renderTab(activeTab)
  }
  syncLangBtn()
  langBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleLang() }, { passive: false })
  langBtn.addEventListener('click', toggleLang)
  footerEl.appendChild(langBtn)
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/game/input/touch-labels.test.ts`
Expected: PASS.

- [ ] **Step 7: Full suite + type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-labels.test.ts
git commit -m "feat(input): language toggle + semantic tab names"
```

---

### Task 5: Style word buttons and the toggle

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Find the existing `.tc-btn` rule**

Run: `grep -n "\.tc-btn\b\|\.tc-kbd\|\.tc-footer" src/style.css`
Expected: shows the current touch-button styling block to match font/sizing conventions.

- [ ] **Step 2: Append styling for named buttons + toggle**

Append to `src/style.css`:

```css
/* Newbie semantic labels: word buttons need smaller text and wrapping,
   unlike the single-glyph defaults. */
.tc-btn.named {
  font-size: 0.72rem;
  line-height: 1.05;
  white-space: normal;
  word-break: keep-all;
  padding: 2px 4px;
}

/* Language toggle in the footer, styled like the other footer buttons. */
.tc-lang {
  font-size: 0.8rem;
  font-weight: 600;
}
```

- [ ] **Step 3: Manual visual check**

Run: `npx vite dev` and open the served URL; connect to a DCSS WebTiles server (or spectate). Confirm: buttons read "자동탐색 / 휴식 / 주문…", text fits without overflowing, the footer shows a 한/EN toggle, and tapping it flips all labels and tab names.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style(input): size word buttons and language toggle"
```

---

### Task 6: Build gate

**Files:** none (verification only)

- [ ] **Step 1: Run the project build**

Run: `npm run build`
Expected: `tsc` passes, `vitest run` passes, `vite build` produces `dist/`. (This is the same gate CI uses.)

- [ ] **Step 2: Commit any incidental fixes**

If the build surfaced a type or lint issue, fix it minimally and commit:

```bash
git add -A
git commit -m "fix: build gate for semantic action bar"
```

---

## Self-Review

**Spec coverage:**
- Semantic action labels instead of raw keys → Tasks 2, 3. ✅
- KO/EN toggle → Tasks 1 (pref), 4 (toggle button). ✅
- Tabbed structure preserved (kept 3 tabs, relabeled) → Task 4 tab labels. ✅
- "Key mapping is the action; sending unchanged" → Task 3 Step 3 keeps `sendTabKey(def)` untouched; test asserts `o` still sent. ✅
- Main-prompt gating → inherited: this only changes `TAB_BUTTONS` presentation; PocketZot's existing context-aware control sets/menus are untouched. No new gating needed for MVP. ✅
- Out of scope (tile-touch travel, menu/targeting friendly labels) → not in this plan, by design. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; tests included with assertions. ✅

**Type consistency:** `UiLang` defined once in `prefs.ts`, imported by `action-labels.ts` and `touch.ts`. `actionLabel` returns `{ text, named }` — used identically in Task 3. `TAB_LABELS` keys (`micro/macro/info/spells`) match `TabKey`. `TAB_BUTTONS` exported in Task 2 Step 4 and consumed by the Task 2 test. ✅

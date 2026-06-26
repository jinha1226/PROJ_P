# Skill preset (save / apply trained-skill set)

## Problem

A fresh character's trained skills depend on its background. A player with a
fixed playstyle (e.g. ranged + a spell school) wants, on every new character, to
quickly set "train only these skills" instead of toggling each by hand in the
skill menu (`m`). The user plays in incognito only, so any preset must persist
**server-side**, not in `localStorage`.

## Design

Two parts, kept separate:

1. **Storage = RC file (data only).** The preset is a list of skill *names*
   stored as one custom RC line — `pocketzot_skill_preset = Ranged Weapons|Hexes`
   — via the existing `get_rc`/`set_rc` + `rc-options.ts` editor (the same
   mechanism that stores `translation_language`). DCSS ignores the unknown key,
   exactly as it already does for `translation_language`. The RC lives on the
   server keyed to the DCSS account, so it survives an incognito session close.
   RC does **not** drive skills — it only remembers the desired set.

2. **Apply = live keystrokes (client).** The actual training is set by the
   client sending skill-letter keystrokes to the open skill menu — the same path
   the existing skill-letter buttons use. No blind macro: it reads the current
   state and toggles only what differs.

### Parsing skill rows

`skill-hotkeys.ts` already anchors a skill row as `<letter> <sign> <name…>` with
sign ∈ `+` (training) / `-` (off) / `*` (focused). Add a `parseSkillRows(lines)`
returning `{ letter, state: '+'|'-'|'*', name }[]`, where `name` is the text
after the sign up to the first 2+-space column gap (so translated names with a
single internal space — "원거리 무기" — stay intact, and the numeric
level/aptitude columns are excluded). Parses the rendered `.crt-line` text, the
same source `updateSkillLetterButtons` reads, so it sees the post-reflow layout.

### Buttons (skill menu only)

In the skills `menuControls` (beside the existing meta + letter buttons), add:

- **저장 / Save** — collect names of rows currently on (`+` or `*`), write
  `pocketzot_skill_preset` to the RC. Brief "저장됨" confirmation on the button.
- **적용 / Apply** — read the saved preset; for each parsed row:
  - name ∈ preset and state `-` → send its letter (turn on)
  - name ∉ preset and state `+`/`*` → send its letter (turn off)
  - already correct → skip
  Disabled / no-op with a hint when no preset is saved yet.

Names joined with `|` (absent from DCSS skill names) in the RC value.

### Flow

New character → open skills (`m`) → tap **적용**. Done. To change the preset:
set skills by hand once, tap **저장**.

## Scope / non-goals

- Lowercase letter = train on/off toggle; `*` (focus) is treated as "on". We
  set on/off only, never focus.
- A target skill not yet shown (e.g. a spell school before you have a spell)
  simply isn't toggled on — it appears once relevant; re-apply then.
- One preset (not multiple named slots) — YAGNI; revisit if needed.
- Apply acts on a single parsed snapshot; toggling a skill doesn't change other
  rows' states, so one pass is correct.

## Testing

- `parseSkillRows`: extracts letter/state/name from `+`/`-`/`*` rows, including
  translated names with an internal space; ignores non-skill lines.
- Preset RC round-trip: save writes `pocketzot_skill_preset`, read parses it
  back (reuse `getRcOption`/`setRcOption`).
- Apply logic (pure function over rows + preset): returns exactly the letters
  whose state must flip; empty when already matching.

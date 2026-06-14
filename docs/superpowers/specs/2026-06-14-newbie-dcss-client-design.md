# Newbie-Friendly Mobile DCSS Client — Design (v1)

**Working title:** PROJ_P (product name TBD)
**Date:** 2026-06-14
**Status:** Design approved (brainstorming complete) → next: implementation plan

---

## ⚠️ License (read first)

This project is a **fork of [PocketZot](https://github.com/pocketzot/pocketzot)**,
which is licensed **AGPL-3.0**. Consequences, accepted by decision:

- This fork **must remain AGPL-3.0**. It cannot be relicensed.
- If hosted as a web service, the **modified source must be made available to
  users** (AGPL network clause).
- It **cannot be commercialized as closed source**, and **must never share code
  with PocketCrawl/PROJ_D** (which is MIT-friendly and GPL-firewalled). The two
  projects stay physically separate (different directories, different repos).
- This is fine: the project is intended as a **free / open-source community
  tool**. A DCSS client connects to free DCSS WebTiles servers; there is nothing
  to commercialize anyway.

## Purpose

PocketZot is an excellent thin mobile client for Dungeon Crawl Stone Soup (DCSS)
WebTiles, but it surfaces the raw DCSS keyboard. Newcomers — especially Korean
players — face two walls: (1) cryptic single-letter commands, and (2) an
English-only interface. This fork lowers both walls **without changing the game**
(all game logic stays server-side; we only change input presentation).

Two newbie pillars:

1. **Tile-touch movement** — tap a visible tile to walk/travel there.
2. **Semantic action bar** — labeled action buttons ("자동탐색 / Explore") instead
   of raw keys, organized into category tabs, with a **KO/EN toggle**.

## Target user

A player new to DCSS (may know roguelikes generally, may not) playing on a phone
in portrait mode, who is blocked by the keyboard-command barrier and/or the
English-only UI. NOT targeting DCSS veterans who already want the raw keyboard
(PocketZot already serves them).

## Architecture

PocketZot is a thin client: vanilla TypeScript + Vite, WebSocket to a DCSS
WebTiles server, PWA. It already parses enough of the WebTiles protocol to render
tap-interactive menus, and the original already groups on-screen keys into
**sub-tabs**. We build on top of that.

**Chosen approach: additive overlay module (Approach A).** Add a self-contained
component ("action bar + tile-travel handler") that:

- reuses PocketZot's existing WebSocket send path to emit keystrokes,
- reads PocketZot's existing game-state to know the current mode,
- touches PocketZot core files as little as possible (isolation; easier to track
  against upstream).

Rejected: (B) editing `input/touch.ts`/`keyboard.ts` directly — too invasive,
conflicts with upstream; (C) config/skin only — too limited to add semantics and
context gating.

## Pillar 1 — Tile-touch movement

DCSS WebTiles natively supports **click-to-travel**: clicking a map cell makes the
server path-find and auto-travel there; an adjacent cell is a single step;
auto-travel stops when a hostile appears (DCSS default). PocketZot already has map
gesture handling, so single-tap → travel is either present or a small addition.

- Tap **adjacent** tile → one step (tapping an adjacent monster = attack into it,
  per DCSS travel-into-monster behavior).
- Tap **far** visible tile → auto-travel toward it.
- Movement is handled entirely by tile-touch, so **the action bar carries no
  directional/movement keys** — freeing tab space for more useful actions.

Exact protocol details (cell message format, travel command) to be confirmed
against PocketZot source during implementation.

## Pillar 2 — Tabbed semantic action bar

Mirror the original's sub-tab UX, but relabel keys as **semantic actions** with a
**KO/EN toggle**. Proposed 4 tabs (movement keys intentionally omitted):

| Tab | Actions (semantic) |
|---|---|
| **탐험 / Explore** | 자동탐색 Explore · 휴식 Rest · 한칸대기 Wait · 계단↓ Down · 계단↑ Up · 전체지도 Map |
| **아이템 / Items** | 줍기 Pick up · 가방 Inventory · 마시기 Quaff · 읽기 Read · 장착(무기) Wield · 착용(방어구) Wear · 발사·던지기 Fire/Throw · 내려놓기 Drop |
| **전투·능력 / Combat** | 주문 Cast · 능력/기도 Abilities · 조사 Look · 노려보기(설명) Describe · 가까운 적 공격 Attack-nearest |
| **정보·시스템 / Info** | 캐릭터 Character · 기술 Skills · 종교 Religion · 게임메뉴 Menu |

**Key-mapping principle (important):** the **action** is the spec; the **DCSS key
each action sends is a lookup table verified against DCSS's own command reference**
(in-game `?` help / source) at implementation time — NOT hardcoded from memory.
DCSS bindings differ by version, and memory is unreliable here (e.g., `x` enters
look mode while `v` describes the target within it — easy to get wrong). The
verified table is filled when the fork is cloned.

KO/EN toggle: each action carries `{ ko, en }` labels; a single setting flips the
displayed language. DCSS's own output (log, menus) stays English in MVP.

## Context gating (the core of the MVP work)

DCSS is **modal**: the same key means different things at the main prompt vs. a
menu vs. a targeting prompt vs. a yes/no prompt. A fixed semantic bar is only
correct at the **main prompt**.

MVP rule:

- Detect "are we at the main prompt?" from PocketZot's game-state / WebTiles
  messages.
- **Main prompt** → show the semantic action bar (and enable tile-touch travel).
- **Any sub-state** (menu, targeting, prompt) → **hide the semantic bar and defer
  to PocketZot's existing tap-menu / input handling.** Do not show wrong labels.

This state-gating is where most of the engineering effort goes. Exact state
signals to be mapped from PocketZot source during planning.

## Scope

**In (MVP):**
- Tile-touch travel (confirm/extend existing).
- Tabbed semantic action bar (4 tabs above), KO/EN toggle.
- Main-prompt-only context gating (defer everything else to existing UI).
- Verified key-mapping lookup table.

**Out (later phases):**
- Friendly labels inside menus / targeting / prompts.
- Action recommendation / tutorial AI ("you should explore now").
- Danger warnings, item-identification help.
- Full localization of DCSS's own output.
- Eating commands (modern DCSS has effectively no food clock).

## Testing

- Unit-test the action→keystroke mapping table and the KO/EN label lookup.
- Unit-test the state-gate predicate (given a WebTiles state, is the bar shown?).
- Manual: connect to a public DCSS WebTiles server, verify each button at the
  main prompt sends the right command; verify the bar hides during menus/
  targeting; verify tile-tap travel and adjacent-tap attack.

## Open questions (deferred to planning/implementation)

- Mirror the original's existing tab grouping verbatim, or adopt the new 4-tab
  reorg? (Leaning 4-tab reorg; revisit once we read the original's real tabs.)
- "계단" button: auto-pick `>`/`<` from the player's current tile, or two
  separate buttons? (Auto-pick needs the under-player tile; decide in planning.)
- Exact WebTiles state signals available for the gate.
- Product name.

## Decision history

See `docs/decision_log.md` for the brainstorming decisions that produced this
spec.

# PROJ_P Decision Log

Durable decisions for the newbie-friendly mobile DCSS client (PocketZot fork).

## 2026-06-14 — Project genesis & brainstorming decisions

**What this is:** a fork of [PocketZot](https://github.com/pocketzot/pocketzot)
(AGPL-3.0) modified to be newbie-friendly: semantic action buttons instead of raw
DCSS keys, plus tile-touch movement, with a Korean/English toggle.

**Why a separate project (not part of PocketCrawl/PROJ_D):**
- PocketZot is AGPL-3.0. A fork must stay AGPL. PocketCrawl is MIT-friendly and
  deliberately GPL-firewalled for a commercial path. Mixing them would taint
  PocketCrawl. → PROJ_P is a **physically separate directory and git repo**;
  **no code is ever shared between PROJ_P and PROJ_D.**

**Decisions made during brainstorming (chronological):**

1. **Idea origin:** while reviewing PocketZot, the user asked whether it could be
   made newbie-friendly — show action-labeled buttons ("o = explore, m = skills")
   instead of the raw keyboard.
2. **Direction:** fork PocketZot and modify it (not "borrow the idea into
   PocketCrawl"). Confirmed this is fine as an **open-source** tool (AGPL
   accepted; no commercialization intended — a DCSS client connects to free
   servers anyway).
3. **Context-awareness scope:** **main-prompt-centric MVP.** The semantic bar is
   correct only at the main prompt; sub-states (menus, targeting, prompts) defer
   to PocketZot's existing tap handling. Full per-state friendly labels are a
   later phase.
4. **Language:** **KO/EN toggle.** Korean-friendly DCSS mobile is the main
   differentiator (there is essentially no such client). DCSS's own output stays
   English in MVP.
5. **Movement:** **tile-touch travel**, like PocketCrawl — DCSS WebTiles supports
   native click-to-travel, so this is feasible and partly present. Because
   movement is by touch, **the action bar carries no directional keys**, freeing
   space.
6. **Action bar layout:** adopt the original's **sub-tab** pattern (the original
   already splits keys into tabs) but relabel keys as **semantic actions**.
   Proposed **4 tabs**: 탐험 / 아이템 / 전투·능력 / 정보·시스템. Approved.
7. **Key-mapping principle:** the **action** is the spec; the DCSS key each action
   sends is a **lookup table verified against DCSS's real command reference at
   implementation time**, not hardcoded from memory (bindings vary by version;
   e.g. `x` = look mode vs `v` = describe-within-look — easy to misremember).
8. **Implementation approach:** **additive overlay module** that reuses
   PocketZot's WebSocket send + game-state, touching core files minimally
   (isolation, upstream-trackable). Rejected direct input-layer edits and
   skin-only.
9. **Process:** AGPL code is **not cloned yet**; only our own design docs are
   written first. Cloning the fork and writing code happens after the
   implementation plan.

**Spec:** `docs/superpowers/specs/2026-06-14-newbie-dcss-client-design.md`

## 2026-06-14 — Upstream cloned for planning; scope refined

- **Clone timing adjusted (supersedes decision #9 ordering):** to write a
  no-placeholder implementation plan we need the real source, so PocketZot was
  forked into PROJ_P now (merged `upstream/main` alongside our docs; `upstream`
  remote retained for syncing) rather than after the plan.
- **Discovery — much of the foundation already exists:**
  - PocketZot already groups controls into **3 tabs** `@` micro / `>` macro /
    `?` info (`ABOUT.md`), and already has **context-aware control sets**.
  - `src/game/input/touch.ts` `TAB_BUTTONS` defines each button as
    `{ label, title, text|key }` — the **English semantic description already
    lives in `title`** ("Auto-explore", "Cast spell", …). So Pillar 2 (semantic
    action bar) is mostly: surface `title` as the label + add Korean + a KO/EN
    toggle. Smaller than feared.
  - Movement is currently a **DPAD** in `touch.ts`; there is **no map
    tap-to-travel handler** yet, so Pillar 1 (tile-touch travel) is genuine new
    work (map cell tap → WebTiles travel command; map render is
    `src/game/map/tile-map-view.ts`, send path is `src/ws/connection.ts`).
- **Tab decision:** lean toward keeping PocketZot's 3-tab structure and
  relabeling, rather than forcing the earlier 4-tab reorg — revisit in the plan.

## 2026-06-14 — Tap-to-move + bottom action strip (layout v2)

Decided (design approved):
- **Tap-to-move (Pillar 1):** WebTiles already exposes `{ msg: 'click_cell', x, y,
  button }` (currently used only by the monster panel with button 3). Add a single
  semantic method `cellAtPoint(clientX, clientY) → {x,y}|null` to BOTH map views
  (`MapView` ascii, `TileMapView` canvas) using each view's own geometry
  (offX/offY, cellPx), and a tap handler in `game-view.ts` that sends
  `click_cell` with `button: 1` on a clean single tap during normal play. Server
  pathfinds (adjacent = step, far = auto-travel, stops on monster sighting).
  Must NOT break existing double-tap-zoom or two-finger tile-toggle; ignored when
  a menu/UI overlay is open or in X-mode (out of scope this pass).
- **Layout v2 (PocketCrawl-style):** remove the on-screen d-pad joystick; render
  the active tab's action buttons as a single compact horizontal (wrapping) strip
  at the bottom; keep the 행동/운영/정보 tabs (24 actions need grouping). Shrink
  `#touch-controls` vertical footprint so the map area (`1fr`) grows.

Deferred (next feature, needs its own brainstorm):
- **Beginner progress guide:** read live species/background/skills/state (client
  already receives them) and surface a skill-priority guide + contextual hints,
  scoped to a few beginner-recommended species/background combos. Content/curation
  is the hard part, not the data access.

## 2026-06-14 — Beginner guide reframed: threat-vs-stats diagnostic (not build matrix)

The per-species×background build-guide matrix is infeasible/subjective. Reframe to
a **reactive diagnostic coach** using live signals the client already receives:
- HUD: HP / AC / EV / SH / XL / str·dex·int (real-time)
- Monster list threat coloring (PocketZot already classifies danger)
- Current depth
Heuristics (nudges, not prescriptions): defense-too-low-for-depth → suggest
armour/shield/retreat; deadly monster + low HP → avoid/heal/funnel; frequent
misses → accuracy/weapon-skill gap. Caveats: server sends no "expected damage"
(estimate from HD/threat + depth danger table); skill values need the skill (m)
screen, so skill-specific advice is secondary to real-time HUD/threat nudges;
keep thresholds conservative and make it toggleable to avoid nagging. To be
brainstormed as its own feature after tap-to-move.

## 2026-06-14 — RC editing in Settings (verified protocol) + few QoL options

WebTiles RC protocol VERIFIED against crawl server source
(`webserver/webtiles/ws_handler.py`): client sends `{msg:'get_rc', game_id}` and
`{msg:'set_rc', game_id, contents}`; server replies `{msg:'rcfile_contents',
game_id, contents}`. Requires login (no spectators); own file only.

Language option key VERIFIED in `initfile.cc`: it is **`language`** (NOT
`translation_language`); `language = ko` for Korean. The game itself warns
translations are PARTIAL ("Languages with at least partial translation: …"), and
Korean coverage is uncertain — surface this honestly; the RC editor is valuable
regardless.

Design:
- `game_id` is only known at `play` time (lobby `conn.send({msg:'play',
  game_id})`); add a tiny shared `current-game` module set there, read by the RC
  service in-game.
- RC service: on opening RC settings, `get_rc` → hold raw rc text; a PURE helper
  `setRcOption(text, key, value|null)` edits/removes one managed line preserving
  the rest; `set_rc` saves.
- Settings panel gains a "게임 옵션 (RC)" section (v1 toggles: `language=ko`,
  `hp_warning=50`, `autofight_stop=50`). UI notes: applies to the NEXT character;
  login required; Korean coverage partial. Framework makes adding toggles easy.

## 2026-06-14 — Beginner Coach v1 (real-time threat-vs-stats nudges)

Implemented as a reactive coach using VERIFIED real-time signals (PlayerMsg:
hp/hp_max/ac/ev/sh/xl/place/depth pushed every turn; MonsterInfo.threat 0-3 +
att for visible monsters). Skills/resists are NOT real-time (need a screen) →
excluded from v1.

Pure evaluator `evaluateCoach(input) → hintId|null`, priority order:
1. poison_lethal (poison will near-kill)
2. critical_hp (hp<33% with a hostile visible)
3. nasty_monster (a threat=3 hostile visible while not in good shape)
4. low_defense (calm — no tough/nasty in view — but AC/EV low for depth)
Conservative thresholds; one hint at a time; throttled; dismissible
`#coach-hint` banner above the message log; localized via uiLang. Toggle
`coachEnabled` pref (default ON) in the settings overlay. Threat estimate is
approximate (DCSS threat tier + depth heuristic) — may be wrong, hence
conservative. Skill-based advice deferred (needs skill screen).

## 2026-06-15 — Korean is CLIENT-SIDE; `translation_language` (corrects 06-14 RC note)

**Correction to the 2026-06-14 RC entry:** mainline DCSS `language` only selects
joke/fake languages (dwarven, …), so `language = ko` is a no-op. The CNC/Nemelex
Korean build reads **`translation_language = ko`** — that is the key the RC
toggle now writes.

But the RC option alone is insufficient: upstream PocketZot parsers assume
English (regexes hard-match English text and break under Korean output). So
translation is done **client-side** (`src/game/i18n/`): `WsConnection.dispatch`
intercepts incoming messages and runs `translateIncoming` BEFORE the handlers,
using a ko/en table plus the Nemelex translation build JSON. Build species/
background are captured PRE-translation (`observeBuildMessage` from the
"Welcome, X the <Species> <Background>." line) so the coach still matches.
Default server set to **Nemelex (CNC)**; new games are Korean from char-select.

## 2026-06-16 — Build-guide coach (winning-replay-derived skill progression)

Complements the reactive threat/stat coach with a **per-build skill-progression
guide** mined from winning ttyrec replays (turn-by-turn skill levels), keyed by
`Species/Background`. Surfaced at the top of the skill (`m`) screen as
"목표 XL… : <skill> <level> · …", colored by sample-size confidence; the
new-game char-select highlights guided species/backgrounds (redder = more
samples). Ruled out (durable): RAG/wiki corpus (too heavy), morgue files
(end-state-maxed, not progression), manual curation (version-drifts). Data:
~191 builds in `src/game/coach/build-guides.ts` (offline pipeline, not in repo).
All three beginner surfaces (hint banner + skill-rec + char-select highlight)
are gated on the single `coachEnabled` toggle.

## 2026-06-17 — Touch-control redesign (d-pad layout, stable grid)

- **D-pad is the default layout.** Controls are a `[d-pad | panel]` flex row;
  panel header = `Esc | 행동/기타 toggle | pinned ⇥(autofight) / O(auto-explore)
  | Enter`. Enter is mandatory (confirms spell targeting), pins sit far-right
  for thumb reach.
- **행동/기타 are one toggle** (only the active tab shown; tap flips). The `z`
  spell-tab is disabled (`ENABLE_SPELL_TAB=false`) — quick-cast lives in the
  floating spell rail, and hidden-spell un-hide is the rail's "+N" toggle.
- **Action strip = fixed 4-column grid** (`repeat(4, minmax(0,1fr))`,
  `width:100%`) with **3 reserved rows**, so button position/size stay constant
  across tabs AND when a menu (inventory/spell list) swaps in its meta-keys — no
  reflow, no map jump. Panel needs `flex:1` to fill the width beside the d-pad
  (without it the grid shrink-wrapped and the UI looked left-clustered).
- Final buttons — 행동 (12): 물약 두루마리 소지품 휴식 / 이동 기술 줍기 주문 /
  관찰 발동 계단↑ 계단↓. 기타 (12): 상태 주문서고 지도 던전개요 / 발사 발동 능력
  시전 / 캐릭터 능력·변이 신앙 룬. (R/^F/older gear cmds dropped; R via Shift+r,
  ^F via Ctrl+f relabels.)

## 2026-06-18 — Settings persistence hardening

- Settings toggles bind **`click` only** (was touchstart+click): a double-bind
  flips the value twice per tap → net no change, so a toggle never stuck.
- `prefs.setPref` keeps an **in-memory override when `localStorage.setItem`
  throws** (private browsing / blocked site storage silently swallowed the
  write, so `getPref` kept returning the old value). The setting now applies for
  the session even with blocked storage; cross-restart persistence still
  requires working storage (else the only durable fix is changing a default).

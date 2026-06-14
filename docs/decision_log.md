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

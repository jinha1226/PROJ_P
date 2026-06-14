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

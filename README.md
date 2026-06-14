# PROJ_P — Newbie-Friendly Mobile DCSS Client (working title)

A **fork of [PocketZot](https://github.com/pocketzot/pocketzot)** that lowers the
barrier for newcomers to Dungeon Crawl Stone Soup on mobile:

- **Tile-touch movement** — tap a tile to travel.
- **Semantic action bar** — labeled action buttons (e.g. "자동탐색 / Explore")
  organized into category tabs, instead of the raw DCSS keyboard.
- **Korean / English toggle.**

The game itself is unchanged: all logic stays server-side (DCSS WebTiles); this
client only changes how input is presented. Built on top of PocketZot's existing
context-aware control sets.

## Status

Design phase. See:
- `docs/superpowers/specs/2026-06-14-newbie-dcss-client-design.md` — design spec
- `docs/decision_log.md` — decisions

`upstream` remote tracks PocketZot for syncing.

## License

**AGPL-3.0-or-later** (inherited from PocketZot). This fork stays AGPL-3.0 and is
an open-source community tool. It shares **no code** with the separate PocketCrawl
project. See [LICENSE](LICENSE) and [ATTRIBUTION.md](ATTRIBUTION.md).

---

## Based on PocketZot

> **Dungeon Crawl Stone Soup (DCSS) WebTiles in your pocket.**
> PocketZot is an unofficial, mobile-first WebTiles client for DCSS. It connects
> to standard DCSS WebTiles servers and speaks the same WebSocket protocol as the
> official client, but replaces rendering and UI with an ASCII-first map, a custom
> touch HUD, and on-screen controls for a phone in portrait mode. Installs as a PWA.
>
> Upstream: https://github.com/pocketzot/pocketzot · pocketzot@proton.me
> TypeScript + Vite, no UI framework. The client holds no game logic.
>
> Notable upstream features we build on: ASCII-first portrait map, optional tiles,
> multi-account login, inline tap regions in menus, **context-aware control sets**,
> floating monster list, map gestures, PWA install.

PocketZot is an independent project, not affiliated with or endorsed by the DCSS
development team. See [ABOUT.md](ABOUT.md) and [ATTRIBUTION.md](ATTRIBUTION.md).

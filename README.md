# PROJ_P — Newbie-Friendly Mobile DCSS Client (working title)

A fork of [PocketZot](https://github.com/pocketzot/pocketzot) that lowers the
barrier for newcomers to Dungeon Crawl Stone Soup on mobile:

- **Tile-touch movement** — tap a tile to travel.
- **Semantic action bar** — labeled action buttons (e.g. "자동탐색 / Explore")
  organized into category tabs, instead of the raw DCSS keyboard.
- **Korean / English toggle.**

The game itself is unchanged: all logic stays server-side (DCSS WebTiles); this
client only changes how input is presented.

## License

**AGPL-3.0** (inherited from PocketZot). This fork stays AGPL-3.0 and is an
open-source community tool. It shares **no code** with the separate PocketCrawl
project.

## Status

Design phase. See:
- `docs/superpowers/specs/2026-06-14-newbie-dcss-client-design.md` — design spec
- `docs/decision_log.md` — decisions

Upstream PocketZot code is not yet cloned; implementation begins after the plan.

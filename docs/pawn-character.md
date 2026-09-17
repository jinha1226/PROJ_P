# Pawn player appearance

Tile mode replaces the player actor layer with existing fantasy pawn PNGs.
ASCII mode, gameplay, server messages, monsters and deployment configuration are unchanged.
Select tile mode using the existing map mode toggle to see the change.

Known species use matching human/elf/dwarf/orc/gnoll/goblin art; other species
currently use a human cosmetic placeholder. Equipment and transformation-specific
appearances are not represented by these pawn images yet. Loading errors keep
the original DCSS actor. Water, clouds, status icons, cursors and HP/MP bars
retain their rendering order. Artwork is locally served under Vite BASE_URL.

Validation: `npm run build` (TypeScript, Vitest, production Vite build).
New tests cover missing images, stale image loads, species changes, player-only
replacement, server-position movement, and bars drawn above the pawn.
These tests do not establish live server gameplay or visual quality on a phone.

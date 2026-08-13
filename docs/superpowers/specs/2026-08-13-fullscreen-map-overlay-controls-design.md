# Full-screen map with overlaid translucent controls

## Problem

On a phone in portrait the map (`#map-wrap` → `#map-grid`) is only the `1fr`
top row of a four-row grid; the HUD, touch controls, and menu rows below it
consume roughly 40% of the screen. The user's complaint is not that glyphs are
too small per se — it is that **only a slice of the screen is the game view**,
so it feels cramped. The touch controls (D-pad, button panels) and the virtual
keyboard overlay are mandatory and cannot be removed or reshaped.

## Goal

Make the map fill the whole screen (minus the retained HUD row) while keeping
every control present and usable, by **floating the touch controls and menu
over the map** instead of giving them their own layout rows — the same
`grid-area:map; position:absolute` pattern the message log, spell rail,
`--more--` prompt, and monster list already use.

Glyph *size* is explicitly out of scope for this change (agreed: "layout
first"). Font size stays width-bound as today.

## Non-goals

- Changing glyph/tile size, zoom defaults, or the fit font cap.
- Reshaping the D-pad or panels into a puck/joystick — they keep their form.
- Auto-hiding or summon-on-demand controls — controls stay always present.
- Landscape layout changes (this is a portrait-first change; landscape keeps
  its sidebar layout untouched unless a rule already applies to both).

## Existing mechanism this reuses (the blueprint)

The floating message log already solves the exact sub-problem:

- `#game-messages`, `#spell-rail`, `#more-btn` are `grid-area: map;
  position: absolute; bottom: 0` — they overlay the map cell and cost no
  layout row (`style.css` portrait block, ~945–969).
- `#game-view #map-grid { padding-bottom: calc(2px + var(--msglog-h)) }`
  reserves the log strip as extra bottom padding (`style.css` ~978).
- `MapView.fitToContainer` reads the computed padding directly and derives
  `reserve = |padBottom − padTop|` (`map-view.ts:155–170`). It sizes the font
  and centers the player in the **clear area** (`availH = rect.height −
  padTop − padBottom`), then fills whole rows back *downward* behind the
  translucent log (`availHFit`), biasing `centerRow` up (`map-view.ts:218–235`).
- `#map-grid { justify-content: flex-start }` in portrait top-anchors the row
  stack so the overrun hangs below, behind the log (`style.css` ~987).

**Key consequence:** the entire glyph-centering / reticle-bias behavior is
driven by the CSS `padding-bottom` value. Increasing that padding by the
control reserve makes the map do the right thing automatically. No new
centering math in `map-view.ts` is required.

## Design

### 1. Grid: drop the touch and menu rows

`#game-view` today (`style.css:726–732`):

```
grid-template-rows: 1fr auto auto auto;
grid-template-areas: "map" "hud" "touch" "menu";
```

becomes:

```
grid-template-rows: 1fr auto;
grid-template-areas: "map" "hud";
```

The HUD (`#game-hud`) stays an in-flow grid row (user decision — not floated),
keeping its position directly below the map. `#touch-controls` and
`#menu-controls` move to overlays over the map cell.

### 2. Float the controls over the map (portrait)

In the portrait media block, give both controls the same overlay treatment as
the log:

```css
#touch-controls, #menu-controls {
  grid-area: map;
  position: absolute;
  left: 0; right: 0; bottom: 0;
  z-index: <see stacking constraint below>;
}
```

Stacking constraint (verify against the current stack during implementation):
the controls must sit **above** the map and the floating log/spell rail
(currently `#spell-rail` z-index 3, `#more-btn` z-index 4) so buttons are never
covered by a message line, and **below** the keyboard overlay (`#kbd-overlay`)
and any full-screen UI overlay (`#ui-overlay`) so those still cover the
controls when open. Pick the concrete value from the current z ladder rather
than hardcoding a guess.

The virtual keyboard overlay (`#kbd-overlay`) already floats — no change.
`#menu-controls` appears only for menus/prompts; when shown it overlays the
map's bottom like the touch controls. It stays effectively opaque for
legibility (menus are interaction-modal); the resting touch controls are the
ones that go translucent.

### 3. Translucent resting controls

`#touch-controls` background moves from `var(--bg)` (opaque, `style.css:2330`)
to a translucent scrim in the same family as the log's `--msglog-bg`
(`color-mix(in srgb, var(--bg) N%, transparent)`), so the map shows through the
gaps between buttons. Buttons themselves keep their opaque fill (they are tap
targets). Exact opacity is a tuning value validated on-device (see §6).

### 4. Reserve: partial, tunable, measured

A new CSS custom property `--touch-h` holds the current touch-controls height.
The map's bottom padding becomes:

```css
#game-view #map-grid {
  padding-bottom: calc(2px + var(--msglog-h) + var(--touch-reserve));
}
```

where `--touch-reserve` = `calc(var(--touch-h) * var(--touch-reserve-frac))`
and `--touch-reserve-frac` defaults to **0.6** (partial reserve — user
decision). Effect: the player reticle sits in the clear area above ~60% of the
control band; the bottom ~40% of the control height overlaps map rows that
render (translucently) behind the controls — those are the far-behind-the-player
tiles, so situational awareness improves rather than degrades.

Because `fitToContainer` already reads computed `padding-bottom`, setting this
padding is the whole integration — the reserve, reticle bias, and downward
row-fill all follow.

### 5. Measuring `--touch-h`

`--touch-h` is dynamic: it changes with D-pad on/off (`dpad-on`), tab content,
edit mode, and the keyboard. A `ResizeObserver` on `#touch-controls` writes its
measured height to `--touch-h` on `#game-view`. That changes `#map-grid`
padding, which the **existing** map-grid ResizeObserver (`game-view.ts:855`)
catches and refits. The refit hysteresis in `fitToContainer`
(`map-view.ts:206–221`) absorbs sub-cell jitter and prevents an observer loop.

Edge cases to handle in the observer:
- Controls hidden (spectator mode uses `#spectator-bar` instead of
  `#touch-controls`, `game-view.ts:826–849`): `--touch-h` resolves to 0.
- `menu-controls` visibility toggling should not thrash the reserve — reserve
  tracks `#touch-controls` height only; `#menu-controls` overlays without
  changing the reserve (it appears transiently for menus).

### 6. D-pad mode gets fixed for free

Today `dpad-on` grows the control area and "the map (1fr) yields the
difference" (`style.css:2337–2344`) — the map shrinks when the D-pad is on.
Once controls overlay, the D-pad no longer steals a layout row; the map stays
full-screen and only the reserve grows by the measured `--touch-h`.

## Components touched

| File | Change |
|---|---|
| `src/style.css` | `#game-view` grid rows/areas; portrait float rules for `#touch-controls`/`#menu-controls`; translucent touch-controls background; `--touch-reserve` in `#map-grid` padding; z-index coordination |
| `src/views/game-view.ts` | `ResizeObserver` on `#touch-controls` → set `--touch-h`; ensure teardown; spectator/no-controls → `--touch-h: 0` |
| `src/game/map/map-view.ts` | **No logic change expected** — reserve flows through existing padding read. Confirm during implementation. |

## Risks & validation

1. **Readability of map behind translucent controls (primary risk).** The log
   precedent works, but the control band is much taller. Mitigations: the
   translucent-scrim opacity (§3) and the `--touch-reserve-frac` (§4) are both
   tunables. Must be validated on a real phone across ASCII and tiles, day and
   night palettes.
2. **Observer loop / refit thrash.** Mitigated by existing hysteresis; verify
   no oscillation when toggling D-pad or opening the keyboard.
3. **Tiles mode.** Tiles full-bleed and anchor top-left; confirm the reserve
   padding does not misplace the canvas (the `.map-tile` anchoring rules,
   `style.css:851–854`, already pin it — verify the extra bottom padding is
   consumed as clear space, not canvas offset).
4. **Touch routing.** Taps on visible map gaps between/around translucent
   controls must still reach the map (travel) vs controls. The log already
   `stopPropagation`s its own taps; the touch-controls buttons are opaque hit
   targets. Verify no dead zones or double-handling.

## Testing

- Unit/DOM: `game-view` tests assert `#touch-controls`/`#menu-controls` carry
  the overlay positioning in portrait and that `--touch-h` is set from measured
  height; spectator path sets it to 0.
- `map-view` reserve behavior is already covered by existing fit tests; add a
  case asserting a larger bottom padding increases `reserve` and biases
  `centerRow` up (mirrors the existing log-reserve assertions).
- Manual on-device validation is the gate for the two tuning values
  (`--touch-reserve-frac`, scrim opacity) — record the chosen values and why.

## Open tuning values (resolve on-device, not in code review)

- `--touch-reserve-frac`: default 0.6.
- Touch-controls resting-scrim opacity: start near the log's `--msglog-bg`
  (bg 30%) and adjust.

# Momentary surroundings view

The lower control bar adds a hold-only magnifier. O, Tab, p and Enter remain.
The old floating +/−/overview controls are replaced by the momentary control.
Press: fit the explored floor in either ASCII or tiles, with stair markers.
Release, pointer cancel/leave, capture loss, blur, tab hiding, a server menu,
a floor clear or controls teardown: return to species-based framing.
Movement, touch commands and keyboard commands are suppressed while held.
No game commands or permanent zoom preference changes are sent by the button.

Default axes include one extra tile on each side: normal 17, Barachi 19, Kobold 11.
Source checked: DCSS `player.cc:update_vision_range()` and
`dat/species/barachi.yaml` (DAYSTALKER 1), `kobold.yaml` (NIGHTSTALKER 3).
`tileweb.cc:send_player` does not export current_vision: this is species-based
framing, NOT exact dynamic vision tracking. Currently visible server cells may
expand the frame; occlusion is never interpreted as reduced vision. Temporary
reductions from equipment, mutations or effects do not automatically shrink it.
Unknown species use the normal radius 7 fallback. No unseen terrain is generated.

Tests cover species axes, visible versus remembered cells, momentary lifecycle,
keyboard/touch command suppression and absence of synthesized-click toggling.

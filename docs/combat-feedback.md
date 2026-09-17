# Combat feedback (client only)

Restores original DCSS player artwork in place of the pawn experiment.
Both ASCII and tile modes show brief, non-interactive feedback at server coordinates.

* Player: floating net HP loss between server snapshots, labelled `−N HP`. This
  can include poison/environmental damage or several hits, not one attack's raw damage.
  Initial snapshots, healing and explicit maximum-HP changes do not trigger it.
* Monsters: an impact ring and wound-stage label when the server MDAM tier worsens.
  No numeric enemy damage is fabricated: the consumed protocol supplies wound
  categories rather than exact enemy HP. Hits within one tier and killing blows
  that remove the monster immediately cannot be inferred and have no added effect.
* The ring lasts 180ms, text 450ms; input is never blocked. Reduced-motion settings
  suppress motion. Overlays are capped at 12 and removed after 460ms.
* No attack ownership is inferred: ally/environmental damage can change a wound tier.

Validation: TypeScript, Vitest and Vite production build. Unit tests exercise
HP deltas, monster identity across movement, first-sighting suppression and cleanup.
Live server play remains the user's playtest; this is not a server combat change.

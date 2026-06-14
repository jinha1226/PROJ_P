// The game_id of the game the player launched, captured at play time so
// in-game features (e.g. RC editing) can reference it. null before any play.
let currentGameId: string | null = null
export function setCurrentGameId(id: string | null): void { currentGameId = id }
export function getCurrentGameId(): string | null { return currentGameId }

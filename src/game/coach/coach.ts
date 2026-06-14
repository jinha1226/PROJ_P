export interface CoachInput {
  hp: number
  hpMax: number
  ac: number
  ev: number
  depth: number
  hostileThreats: number[] // threat tiers (0-3) of currently-visible HOSTILE monsters
  poisonLethal: boolean    // poison is on track to (near-)kill the player
}

export type CoachHintId = 'poison_lethal' | 'critical_hp' | 'nasty_monster' | 'low_defense'

export const COACH_HINTS: Record<CoachHintId, { ko: string; en: string }> = {
  poison_lethal: {
    ko: '독이 치명적이에요 — 해독하거나 회복하세요.',
    en: 'Poison may kill you — cure it or heal.',
  },
  critical_hp: {
    ko: '위험! HP가 낮아요 — 후퇴하거나 회복하세요.',
    en: 'Danger! Low HP — retreat or heal.',
  },
  nasty_monster: {
    ko: '강한 적이에요 — 정면 대결을 피하고 통로로 유인하세요.',
    en: 'Tough enemy — avoid a head-on fight; funnel it in a corridor.',
  },
  low_defense: {
    ko: '이 깊이엔 방어가 약해요 — 갑옷·방패·인챈트를 챙기세요.',
    en: 'Low defense for this depth — get armour, a shield, or enchant.',
  },
}

// Conservative thresholds; returns the single highest-priority hint, or null.
export function evaluateCoach(i: CoachInput): CoachHintId | null {
  const hpFrac = i.hpMax > 0 ? i.hp / i.hpMax : 1
  const hostileVisible = i.hostileThreats.length > 0
  const hasNasty = i.hostileThreats.some(t => t >= 3)
  const hasToughOrWorse = i.hostileThreats.some(t => t >= 2)

  if (i.poisonLethal) return 'poison_lethal'
  if (hpFrac < 0.33 && hostileVisible) return 'critical_hp'
  if (hasNasty && hpFrac < 0.6) return 'nasty_monster'
  // Defense advice only when calm (nothing tough/nasty in view) and clearly under-armored.
  if (i.depth >= 2 && !hasToughOrWorse && i.ac < i.depth && i.ev < 13) return 'low_defense'
  return null
}

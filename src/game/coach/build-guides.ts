// Build-based skill guides: median skill levels of competent players (won or
// 2+ runes) per build, by XL milestone. Source: crawl.dcss.io 0.34 logfile,
// derived from replay (ttyrec) skill snapshots; `n` = sample size per build.
// Validated 5-build slice — the full dataset is produced by the offline
// pipeline and dropped in here.

export interface BuildGuide { n: number; milestones: Record<string, Record<string, number>> }

export const BUILD_GUIDES: Record<string, BuildGuide> = {
  "Minotaur/Fighter": {
    "n": 11,
    "milestones": {
      "1": {
        "Fighting": 3.6,
        "Armour": 3.6,
        "Shields": 3.6,
        "Axes": 2.4,
        "Maces & Flails": 1.3,
        "Polearms": 1.3
      },
      "3": {
        "Fighting": 3.6,
        "Armour": 3.6,
        "Shields": 3.6,
        "Axes": 2.4,
        "Maces & Flails": 1.3,
        "Polearms": 1.3
      },
      "5": {
        "Fighting": 3.6,
        "Armour": 3.6,
        "Shields": 3.6,
        "Axes": 2.4,
        "Maces & Flails": 1.3,
        "Polearms": 1.3
      },
      "7": {
        "Axes": 5.3,
        "Fighting": 3.6,
        "Maces & Flails": 3.6,
        "Armour": 3.6,
        "Shields": 3.6,
        "Polearms": 3.4
      },
      "9": {
        "Axes": 6.0,
        "Polearms": 4.5,
        "Maces & Flails": 4.1,
        "Fighting": 3.9,
        "Armour": 3.6,
        "Shields": 3.6
      },
      "12": {
        "Axes": 12.9,
        "Fighting": 9.7,
        "Armour": 9.7,
        "Polearms": 8.8,
        "Maces & Flails": 8.2,
        "Shields": 7.6
      },
      "15": {
        "Axes": 17.3,
        "Armour": 12.1,
        "Fighting": 12.0,
        "Shields": 11.6,
        "Polearms": 11.5,
        "Maces & Flails": 11.3
      },
      "18": {
        "Axes": 18.0,
        "Armour": 15.4,
        "Fighting": 14.1,
        "Shields": 12.0,
        "Maces & Flails": 11.7,
        "Polearms": 11.7
      },
      "21": {
        "Axes": 18.0,
        "Armour": 15.4,
        "Fighting": 14.1,
        "Shields": 12.0,
        "Maces & Flails": 11.7,
        "Polearms": 11.7
      },
      "27": {
        "Axes": 18.0,
        "Armour": 15.4,
        "Fighting": 14.1,
        "Shields": 12.0,
        "Maces & Flails": 11.7,
        "Polearms": 11.7
      }
    }
  },
  "Minotaur/Berserker": {
    "n": 12,
    "milestones": {
      "1": {
        "Fighting": 3.6,
        "Axes": 3.6,
        "Armour": 2.4,
        "Maces & Flails": 2.1,
        "Polearms": 2.1,
        "Dodging": 2.1
      },
      "3": {
        "Fighting": 3.6,
        "Axes": 3.6,
        "Armour": 2.4,
        "Maces & Flails": 2.1,
        "Polearms": 2.1,
        "Dodging": 2.1
      },
      "5": {
        "Axes": 4.1,
        "Fighting": 3.8,
        "Maces & Flails": 2.4,
        "Polearms": 2.4,
        "Armour": 2.4,
        "Dodging": 2.1
      },
      "7": {
        "Axes": 5.5,
        "Fighting": 4.0,
        "Maces & Flails": 3.3,
        "Polearms": 3.3,
        "Armour": 2.4,
        "Dodging": 2.1
      },
      "9": {
        "Axes": 7.0,
        "Fighting": 4.8,
        "Maces & Flails": 4.2,
        "Polearms": 4.2,
        "Armour": 2.6,
        "Dodging": 2.1
      },
      "12": {
        "Axes": 12.8,
        "Fighting": 11.6,
        "Armour": 9.1,
        "Polearms": 9.0,
        "Maces & Flails": 8.1,
        "Dodging": 3.0
      },
      "15": {
        "Axes": 16.0,
        "Fighting": 14.6,
        "Armour": 12.4,
        "Polearms": 10.6,
        "Maces & Flails": 10.3,
        "Shields": 10.1
      },
      "18": {
        "Fighting": 17.5,
        "Armour": 17.2,
        "Axes": 16.0,
        "Shields": 12.0,
        "Polearms": 11.7,
        "Maces & Flails": 10.3
      },
      "21": {
        "Armour": 18.1,
        "Fighting": 17.1,
        "Axes": 16.0,
        "Shields": 15.6,
        "Polearms": 11.7,
        "Maces & Flails": 10.3
      },
      "27": {
        "Armour": 18.0,
        "Shields": 17.1,
        "Axes": 16.0,
        "Fighting": 15.8,
        "Polearms": 11.7,
        "Maces & Flails": 10.3
      }
    }
  },
  "Gargoyle/Fighter": {
    "n": 12,
    "milestones": {
      "1": {
        "Fighting": 3.2,
        "Armour": 3.2,
        "Shields": 3.2,
        "Maces & Flails": 2.0,
        "Staves": 1.1,
        "Axes": 1.0
      },
      "3": {
        "Fighting": 3.5,
        "Armour": 3.3,
        "Shields": 3.2,
        "Axes": 2.0,
        "Maces & Flails": 1.6,
        "Polearms": 1.3
      },
      "5": {
        "Fighting": 3.5,
        "Armour": 3.5,
        "Shields": 3.2,
        "Maces & Flails": 2.0,
        "Axes": 2.0,
        "Polearms": 1.3
      },
      "7": {
        "Fighting": 3.5,
        "Armour": 3.5,
        "Shields": 3.3,
        "Maces & Flails": 2.4,
        "Axes": 2.3,
        "Staves": 1.2
      },
      "9": {
        "Armour": 6.6,
        "Fighting": 6.2,
        "Axes": 4.6,
        "Maces & Flails": 4.0,
        "Shields": 3.5,
        "Polearms": 3.4
      },
      "12": {
        "Fighting": 9.9,
        "Armour": 9.2,
        "Axes": 7.4,
        "Maces & Flails": 6.5,
        "Polearms": 6.2,
        "Shields": 5.2
      },
      "15": {
        "Fighting": 12.0,
        "Armour": 10.2,
        "Axes": 9.4,
        "Polearms": 7.5,
        "Shields": 7.1,
        "Maces & Flails": 6.5
      },
      "18": {
        "Fighting": 13.3,
        "Armour": 10.2,
        "Axes": 9.6,
        "Polearms": 8.5,
        "Maces & Flails": 7.1,
        "Shields": 7.1
      },
      "21": {
        "Fighting": 13.3,
        "Armour": 10.2,
        "Axes": 9.6,
        "Polearms": 8.7,
        "Maces & Flails": 7.1,
        "Shields": 7.1
      },
      "27": {
        "Fighting": 10.6,
        "Armour": 10.2,
        "Polearms": 9.8,
        "Axes": 9.6,
        "Maces & Flails": 7.1,
        "Shields": 7.1
      }
    }
  },
  "Coglin/Hunter": {
    "n": 12,
    "milestones": {
      "1": {
        "Ranged Weapons": 3.6,
        "Fighting": 2.0,
        "Dodging": 1.7,
        "Stealth": 0.7,
        "Spellcasting": 0.0,
        "Unarmed Combat": 0.0
      },
      "3": {
        "Ranged Weapons": 3.6,
        "Fighting": 2.0,
        "Dodging": 1.7,
        "Stealth": 0.7,
        "Spellcasting": 0.0,
        "Unarmed Combat": 0.0
      },
      "5": {
        "Ranged Weapons": 3.6,
        "Fighting": 2.0,
        "Dodging": 1.7,
        "Stealth": 0.7,
        "Spellcasting": 0.0,
        "Unarmed Combat": 0.0
      },
      "7": {
        "Ranged Weapons": 3.6,
        "Fighting": 2.0,
        "Dodging": 1.7,
        "Stealth": 0.7,
        "Spellcasting": 0.0,
        "Unarmed Combat": 0.0
      },
      "9": {
        "Ranged Weapons": 5.4,
        "Fighting": 3.0,
        "Dodging": 1.8,
        "Stealth": 0.7,
        "Spellcasting": 0.0,
        "Unarmed Combat": 0.0
      },
      "12": {
        "Ranged Weapons": 10.0,
        "Fighting": 8.6,
        "Dodging": 5.0,
        "Stealth": 0.7,
        "Armour": 0.2,
        "Spellcasting": 0.0
      },
      "15": {
        "Fighting": 11.6,
        "Ranged Weapons": 11.5,
        "Dodging": 5.8,
        "Invocations": 5.5,
        "Stealth": 0.7,
        "Armour": 0.5
      },
      "18": {
        "Ranged Weapons": 13.9,
        "Fighting": 12.7,
        "Dodging": 8.3,
        "Invocations": 7.3,
        "Evocations": 5.0,
        "Armour": 3.0
      },
      "21": {
        "Ranged Weapons": 14.5,
        "Fighting": 12.8,
        "Dodging": 8.3,
        "Invocations": 7.4,
        "Evocations": 5.0,
        "Armour": 3.0
      },
      "27": {
        "Ranged Weapons": 14.5,
        "Fighting": 12.8,
        "Dodging": 8.3,
        "Invocations": 7.4,
        "Evocations": 5.0,
        "Armour": 3.0
      }
    }
  },
  "Gargoyle/Earth Elementalist": {
    "n": 12,
    "milestones": {
      "1": {
        "Earth Magic": 3.6,
        "Stealth": 2.1,
        "Spellcasting": 2.0,
        "Dodging": 1.5,
        "Conjurations": 1.1,
        "Fighting": 0.0
      },
      "3": {
        "Earth Magic": 4.0,
        "Stealth": 2.1,
        "Spellcasting": 2.0,
        "Dodging": 1.5,
        "Conjurations": 1.1,
        "Fighting": 0.0
      },
      "5": {
        "Earth Magic": 4.5,
        "Stealth": 2.1,
        "Spellcasting": 2.0,
        "Conjurations": 2.0,
        "Dodging": 1.5,
        "Fighting": 0.0
      },
      "7": {
        "Earth Magic": 6.0,
        "Conjurations": 4.2,
        "Spellcasting": 3.4,
        "Stealth": 2.1,
        "Fighting": 2.0,
        "Dodging": 1.5
      },
      "9": {
        "Earth Magic": 9.6,
        "Spellcasting": 6.0,
        "Conjurations": 6.0,
        "Fighting": 3.0,
        "Stealth": 2.5,
        "Dodging": 1.5
      },
      "12": {
        "Spellcasting": 10.0,
        "Earth Magic": 9.8,
        "Conjurations": 6.8,
        "Fighting": 6.1,
        "Ice Magic": 4.0,
        "Translocations": 3.0
      },
      "15": {
        "Earth Magic": 12.3,
        "Spellcasting": 11.6,
        "Fighting": 9.0,
        "Conjurations": 8.4,
        "Ice Magic": 4.0,
        "Stealth": 3.3
      },
      "18": {
        "Spellcasting": 12.9,
        "Earth Magic": 12.7,
        "Fighting": 9.3,
        "Conjurations": 8.4,
        "Ice Magic": 4.0,
        "Stealth": 3.3
      },
      "21": {
        "Spellcasting": 12.9,
        "Earth Magic": 12.7,
        "Fighting": 11.0,
        "Conjurations": 8.4,
        "Ice Magic": 4.0,
        "Stealth": 3.3
      },
      "27": {
        "Earth Magic": 14.7,
        "Spellcasting": 12.9,
        "Fighting": 11.0,
        "Conjurations": 9.9,
        "Shields": 5.0,
        "Stealth": 3.3
      }
    }
  }
}

// DCSS skill names in Korean, to match the (translated) in-game skill menu.
const SKILL_KO: Record<string, string> = {
  "Fighting": "전투",
  "Short Blades": "단검",
  "Long Blades": "장검",
  "Axes": "도끼",
  "Maces & Flails": "둔기",
  "Polearms": "창",
  "Staves": "지팡이",
  "Ranged Weapons": "원거리",
  "Unarmed Combat": "맨손",
  "Throwing": "투척",
  "Armour": "방어구",
  "Dodging": "회피",
  "Stealth": "은신",
  "Shields": "방패",
  "Spellcasting": "주문시전",
  "Conjurations": "파괴마법",
  "Hexes": "저주마법",
  "Summonings": "소환마법",
  "Necromancy": "강령마법",
  "Translocations": "이동마법",
  "Fire Magic": "화염마법",
  "Ice Magic": "냉기마법",
  "Air Magic": "대기마법",
  "Earth Magic": "대지마법",
  "Alchemy": "연금술",
  "Invocations": "발현",
  "Evocations": "발동",
  "Shapeshifting": "변신"
}

export function skillKo(en: string): string { return SKILL_KO[en] ?? en }
export function buildKey(species: string, background: string): string { return `${species}/${background}` }

export interface RecItem { skill: string; ko: string; level: number }
export interface Rec { key: string; xl: number; items: RecItem[] }

// Recommendation is a forward TARGET: the skill levels a competent player has
// at a milestone ABOVE the player's current XL — what to train toward, not
// where they already are. Early milestones are nearly identical to the start
// skills, so we skip ahead to the first milestone whose top skill is
// meaningfully higher than the current level (and fall back to the furthest
// known milestone). null if no guide for this build.
export function recommend(species: string, background: string, xl: number, top = 4): Rec | null {
  const g = BUILD_GUIDES[buildKey(species, background)]
  if (!g) return null
  const keys = Object.keys(g.milestones).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) return null
  const topLevel = (k: number): number => Math.max(...Object.values(g.milestones[String(k)]))

  const atOrBelow = keys.filter(m => m <= xl)
  const curTop = atOrBelow.length ? topLevel(atOrBelow[atOrBelow.length - 1]) : 0
  const above = keys.filter(m => m > xl)
  // Default to the furthest known milestone (the eventual goal); prefer the
  // nearest one that's a real step up from where the player is now.
  let mk = above.length ? above[above.length - 1] : keys[keys.length - 1]
  for (const m of above) {
    if (topLevel(m) > curTop + 1) { mk = m; break }
  }

  const at = g.milestones[String(mk)]
  const items = Object.entries(at).sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([skill, level]) => ({ skill, ko: skillKo(skill), level }))
  return { key: buildKey(species, background), xl: mk, items }
}

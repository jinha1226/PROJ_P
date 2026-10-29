// Korean for the SPD-style chrome (spd-*.ts) — the labels PocketZot itself
// adds, not game text (DWEM's translation module handles that). Korean when
// the device asks for it or DWEM is translating the game into it, so the
// chrome matches the log; English otherwise.

import { translationModule } from '../../dwem/translation-module'

const KO: Record<string, string> = {
  // Toolbar
  Bag: '가방', Backpack: '배낭', Wait: '대기', Explore: '탐험', Keys: '키패드',
  Cancel: '취소', Next: '다음', Fire: '발사',
  'Wait a turn — hold to rest': '한 턴 대기 — 길게 누르면 휴식',
  'Auto-explore': '자동 탐험', 'Show the keypad': '키패드 보기',
  'Cancel targeting': '조준 취소', 'Next target': '다음 대상', 'Fire at the target': '대상에게 발사',
  'Empty quickslot — tap to assign': '빈 퀵슬롯 — 탭해서 등록',
  'hold to change': '길게 눌러 변경',
  // Bag
  All: '전체', Gear: '장비', Potions: '물약', Scrolls: '두루마리', Wands: '완드', Misc: '기타',
  Spells: '주문', Abilities: '능력',
  'Full list': '전체 목록', 'Clear slot': '슬롯 비우기', 'Take off': '벗기', 'Info / more': '정보·더보기',
  Quickslot: '퀵슬롯', 'pick one': '선택', 'Tap one to pin it to the slot.': '탭하면 슬롯에 등록돼요.',
  'Load abilities': '능력 불러오기', '↻ Reload abilities': '↻ 능력 다시 불러오기',
  'No spells memorised.': '외운 주문이 없어요.', 'No abilities.': '능력이 없어요.',
  'Abilities not loaded yet.': '능력을 아직 불러오지 않았어요.', 'Nothing here.': '비어 있어요.',
  fail: '실패',
  Drink: '마시기', Read: '읽기', Evoke: '발동', Throw: '던지기', Equip: '장착', Use: '사용', Cast: '시전',
  // Indicators, hero window
  'Pick up': '줍기', 'Hostiles in view': '보이는 적', Attack: '공격',
  Status: '상태', Skills: '스킬', Memorise: '암기', Traits: '특성', Hero: '영웅', Close: '닫기',
}

export function spdKorean(): boolean {
  if (translationModule.activeLanguage === 'ko') return true
  try {
    return (navigator.language ?? '').toLowerCase().startsWith('ko')
  } catch {
    return false
  }
}

export function tr(en: string): string {
  return spdKorean() ? KO[en] ?? en : en
}

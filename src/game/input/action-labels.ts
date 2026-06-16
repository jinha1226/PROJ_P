import type { UiLang } from '../../prefs'

export interface LabelPair { ko: string; en: string }

// Keyed by the English `title` string used in touch.ts TAB_BUTTONS. Labels are
// kept short so they fit a touch button; the full `title` remains the tooltip.
export const ACTION_LABELS: Record<string, LabelPair> = {
  // menu mode (! and ? keep their literal key glyph — matches DCSS footer hints)
  'Page down':            { ko: '페이지',   en: 'Page' },
  // modifier strips
  'Quiver':               { ko: '화살집',   en: 'Quiver' },
  'Save & exit':          { ko: '저장/종료', en: 'Save/Exit' },
  // micro
  'Auto-fight nearest':   { ko: '자동전투', en: 'Fight' },
  'Rest until healed':    { ko: '휴식',     en: 'Rest' },
  'Inventory':            { ko: '소지품',   en: 'Items' },
  'Auto-explore':         { ko: '자동탐색', en: 'Explore' },
  'Quaff potion':         { ko: '물약',     en: 'Quaff' },
  'Read scroll':          { ko: '두루마리', en: 'Read' },
  'Fire / quivered':      { ko: '발사',     en: 'Fire' },
  'Evoke item':           { ko: '발동',     en: 'Evoke' },
  'Use ability':          { ko: '능력',     en: 'Ability' },
  'Cast spell':           { ko: '주문',     en: 'Cast' },
  'Examine surroundings': { ko: '관찰',     en: 'Look' },
  'Pick up item':         { ko: '줍기',     en: 'Pick up' },
  // macro
  'Wield weapon':              { ko: '무기',     en: 'Wield' },
  'Remove jewellery':          { ko: '장신구해제', en: 'Remove' },
  'Tell allies (tt to shout)': { ko: '명령',     en: 'Tell' },
  'Put on jewellery':          { ko: '장신구',   en: 'Put on' },
  'Drop':                      { ko: '버리기',   en: 'Drop' },
  'Find feature (Ctrl+F)':     { ko: '지형찾기', en: 'Find' },
  'Go to level / branch':      { ko: '이동',     en: 'Travel' },
  'Dungeon overview (Ctrl+O)': { ko: '던전개요', en: 'Overview' },
  'Examine level map':         { ko: '지도',     en: 'Map' },
  'Equip / exclude':           { ko: '장착',     en: 'Equip' },
  'Ascend stairs':             { ko: '계단↑',   en: 'Up' },
  'Descend stairs':            { ko: '계단↓',   en: 'Down' },
  // info
  'Character status':                  { ko: '상태',     en: 'Status' },
  'Character overview':                { ko: '캐릭터',   en: 'Character' },
  'Religion / deity':                  { ko: '신앙',     en: 'Religion' },
  'Reassign inventory/spell letters':  { ko: '글자정리', en: 'Reassign' },
  'Abilities/mutations':               { ko: '능력·변이', en: 'Abilities' },
  'Skills screen':                     { ko: '기술',     en: 'Skills' },
  'Runes collected':                   { ko: '룬',       en: 'Runes' },
  'Item knowledge':                    { ko: '아이템지식', en: 'Known' },
  'Gold / shopping list':              { ko: '소지금',   en: 'Gold' },
  'Spell library':                     { ko: '주문서고', en: 'Library' },
  'List memorised spells':             { ko: '암기주문', en: 'Spells' },
  'Help':                              { ko: '도움말',   en: 'Help' },
}

export const TAB_LABELS: Record<'micro' | 'macro' | 'spells', LabelPair> = {
  micro:  { ko: '행동', en: 'Act' },
  macro:  { ko: '기타', en: 'More' },   // merged 운영 + 정보
  spells: { ko: '주문', en: 'Spells' },
}

// Returns the display text and whether it is a semantic (word) label. When the
// action is unknown, falls back to the raw key glyph so nothing breaks.
export function actionLabel(
  def: { label: string; title?: string },
  lang: UiLang,
): { text: string; named: boolean } {
  const pair = def.title ? ACTION_LABELS[def.title] : undefined
  if (!pair) return { text: def.label, named: false }
  return { text: pair[lang], named: true }
}

import { describe, it, expect } from 'vitest'
import { actionLabel, ACTION_LABELS, TAB_LABELS } from './action-labels'
import { TAB_BUTTONS } from './touch'

describe('actionLabel', () => {
  it('returns the Korean label for a known title', () => {
    const r = actionLabel({ label: 'o', title: 'Auto-explore' }, 'ko')
    expect(r).toEqual({ text: '자동탐색', named: true })
  })

  it('returns the English label for a known title', () => {
    const r = actionLabel({ label: 'o', title: 'Auto-explore' }, 'en')
    expect(r).toEqual({ text: 'Explore', named: true })
  })

  it('falls back to the raw label when title is unknown', () => {
    const r = actionLabel({ label: '☠', title: 'Mystery command' }, 'ko')
    expect(r).toEqual({ text: '☠', named: false })
  })

  it('falls back to the raw label when there is no title', () => {
    const r = actionLabel({ label: 'Z' }, 'en')
    expect(r).toEqual({ text: 'Z', named: false })
  })
})

describe('label coverage', () => {
  it('every TAB_BUTTONS title has a KO and EN label', () => {
    const missing: string[] = []
    for (const rows of Object.values(TAB_BUTTONS)) {
      for (const row of rows) {
        for (const def of row) {
          if (!def.title) continue
          const pair = ACTION_LABELS[def.title]
          if (!pair || !pair.ko || !pair.en) missing.push(def.title)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('every tab has a KO and EN label', () => {
    for (const key of ['micro', 'macro', 'spells'] as const) {
      expect(TAB_LABELS[key].ko.length).toBeGreaterThan(0)
      expect(TAB_LABELS[key].en.length).toBeGreaterThan(0)
    }
  })
})

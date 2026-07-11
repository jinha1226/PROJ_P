import { describe, it, expect } from 'vitest'
import { applyLayoutSync, encodeLayout, type TouchLayout } from './custom-layout'
import { getRcComment, setRcComment } from '../rc/rc-options'
import { defaultLayout, CATALOG_BY_ID } from './touch-catalog'

const known = (id: string): boolean => CATALOG_BY_ID.has(id)

function customized(): TouchLayout {
  const l = defaultLayout()
  l.dpad.side = 'right'
  return l
}

describe('applyLayoutSync', () => {
  it('backs up a local layout into the RC comment', () => {
    const { newRcText, restored } = applyLayoutSync('hp_warning = 50\n', customized(), known)
    expect(restored).toBeNull()
    expect(newRcText).not.toBeNull()
    expect(getRcComment(newRcText!, 'layout')).toBe(encodeLayout(customized()))
  })

  it('restores from RC when local is empty', () => {
    const rc = setRcComment('', 'layout', encodeLayout(customized()))
    const { newRcText, restored } = applyLayoutSync(rc, null, known)
    expect(newRcText).toBeNull()
    expect(restored).toEqual(customized())
  })

  it('no-ops when both match or both empty', () => {
    const rc = setRcComment('', 'layout', encodeLayout(customized()))
    expect(applyLayoutSync(rc, customized(), known)).toEqual({ newRcText: null, restored: null })
    expect(applyLayoutSync('x = 1\n', null, known)).toEqual({ newRcText: null, restored: null })
  })

  it('treats a corrupt RC backup as absent (re-backs-up local)', () => {
    const rc = setRcComment('', 'layout', '!!!corrupt!!!')
    const { newRcText } = applyLayoutSync(rc, customized(), known)
    expect(getRcComment(newRcText!, 'layout')).toBe(encodeLayout(customized()))
  })
})

import { describe, it, expect } from 'vitest'
import { getRcOption, setRcOption } from './rc-options'

describe('getRcOption', () => {
  it('reads a value, trimming whitespace', () => {
    expect(getRcOption('foo = 1\nlanguage = ko\n', 'language')).toBe('ko')
  })
  it('returns null when absent', () => {
    expect(getRcOption('foo = 1\n', 'language')).toBeNull()
  })
  it('ignores commented lines', () => {
    expect(getRcOption('# language = ko\n', 'language')).toBeNull()
  })
})

describe('setRcOption', () => {
  it('appends when the key is absent (with trailing newline)', () => {
    expect(setRcOption('foo = 1\n', 'language', 'ko')).toBe('foo = 1\nlanguage = ko\n')
  })
  it('replaces an existing value in place', () => {
    expect(setRcOption('a = 1\nlanguage = en\nb = 2\n', 'language', 'ko'))
      .toBe('a = 1\nlanguage = ko\nb = 2\n')
  })
  it('removes the line when value is null', () => {
    expect(setRcOption('a = 1\nlanguage = ko\nb = 2\n', 'language', null))
      .toBe('a = 1\nb = 2\n')
  })
  it('is a no-op removing an absent key', () => {
    expect(setRcOption('a = 1\n', 'language', null)).toBe('a = 1\n')
  })
  it('appends to empty content', () => {
    expect(setRcOption('', 'language', 'ko')).toBe('language = ko\n')
  })
  it('does not touch commented lines when replacing', () => {
    expect(setRcOption('# language = en\nlanguage = en\n', 'language', 'ko'))
      .toBe('# language = en\nlanguage = ko\n')
  })
})

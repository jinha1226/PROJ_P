import { describe, expect, it } from 'vitest'
import type { IncomingMessage } from './io-hook'
import { translateIncomingMessage } from './translation-module'
import { TranslationDataManager } from './translation/data-manager'
import { Translator } from './translation/translator'

describe('TranslationModule wire envelopes', () => {
  it('translates messages nested in a ui-stack snapshot', () => {
    const translator = new Translator([
      {
        category: 'ui-push@title',
        raw: 'Please select your species.',
        replaceValue: { ko: '종족을 선택하세요.' },
      },
    ], TranslationDataManager.functions)
    const message = {
      msg: 'ui-stack',
      items: [{ msg: 'ui-push', type: 'newgame-choice', title: 'Please select your species.' }],
    } as IncomingMessage

    translateIncomingMessage(message, translator, 'ko')

    expect(message.items).toEqual([
      { msg: 'ui-push', type: 'newgame-choice', title: '종족을 선택하세요.' },
    ])
  })
})

// Client-side message translation, ported from refracta's pocketzot-dwem
// (src/dwem/translation-module.ts), adapted to pocketzot's own message
// pipeline instead of the DWEM ioHook/rcManager runtime.
//
// DCSS itself sends English over WebTiles; the Korean DCSS community (CNC /
// Nemelex) translates client-side. On game start we read translation_language
// from the player's RC, fetch a translation "build" (raw + regex matchers)
// from translation_file, and rewrite the text fields of every incoming server
// message in place — so all downstream rendering (messages, monster names,
// menus, item names, …) comes out translated. A matching web font is loaded
// so the glyphs render.
//
// Caveat: translation happens before pocketzot's own handlers see the message,
// so any internal logic that pattern-matches English server text (harvest
// detection, coach hints, status colouring, skill-hotkey extraction) must be
// made language-independent separately — see the project notes.

import type { ServerMsg } from '../../ws/types'
import { Translator, applySpecialPatterns, type TranslationMatcher } from './translator'
import { TranslationDataManager } from './data-manager'
import { getRcOption } from '../rc/rc-options'

const DEFAULT_TRANSLATION_FILE = 'https://translation.nemelex.cards/build/latest.json'
const FONT_STYLE_ID = 'pz-translation-font'

interface TranslationBuild {
  matchers: TranslationMatcher[]
  time?: number | string
  messages?: string[]
}

class Translation {
  constructor(
    private readonly translator: Translator,
    private readonly language: string,
  ) {}

  // Mutates `msg` in place: for each registered category whose processor
  // matches this message, extract the translatable strings, translate them,
  // and write them back. Per-string failures fall back to the original text.
  translateIncoming(msg: ServerMsg): void {
    for (const [category, processor] of Object.entries(TranslationDataManager.processors)) {
      if (!processor.match(msg)) continue
      const originals = processor.extract(msg)
      if (originals.length === 0) continue
      const translated = originals.map((text) => {
        try {
          return this.translator.translate(text, this.language, category).translation
        } catch {
          return text
        }
      })
      processor.restore(
        msg,
        translated.map((t) => applySpecialPatterns(t, TranslationDataManager.functions)),
      )
    }
  }
}

let active: Translation | null = null

// Apply the active translation (if any) to an incoming server message before
// pocketzot's handlers run. Called from the WS connection's receive path.
export function translateIncoming(msg: ServerMsg): void {
  active?.translateIncoming(msg)
}

export function translationActive(): boolean {
  return active !== null
}

// Read the player's RC and, if translation_language is set, fetch the build
// and arm translation. Idempotent: tears down any prior state first. Safe to
// call with the same RC repeatedly (e.g. rcfile_contents echoes).
export async function initTranslationFromRc(rcText: string): Promise<void> {
  const language = getRcOption(rcText, 'translation_language')
  if (!language) {
    teardownTranslation()
    return
  }
  // Already armed for this language — keep the loaded build rather than refetch.
  if (active) return

  const file = getRcOption(rcText, 'translation_file') || DEFAULT_TRANSLATION_FILE
  if (rcBool(rcText, 'use_translation_font', true)) loadTranslationFont(language)

  try {
    const build = await fetchJsonWithTimeout<TranslationBuild>(file, 5000)
    active = new Translation(
      new Translator(build.matchers, TranslationDataManager.functions, false),
      language,
    )
  } catch (err) {
    console.error('[i18n] translation init failed', err)
    teardownTranslation()
  }
}

export function teardownTranslation(): void {
  active = null
  unloadTranslationFont()
}

function rcBool(rcText: string, key: string, dflt: boolean): boolean {
  const v = getRcOption(rcText, key)
  if (v === null) return dflt
  return /^(true|yes|1)$/i.test(v.trim())
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

// --- Web font for translated glyphs ---

function loadTranslationFont(language: string): void {
  unloadTranslationFont()
  const css = translationFontCss(language)
  if (!css) return
  const style = document.createElement('style')
  style.id = FONT_STYLE_ID
  style.textContent = `${css.fontFaces}\n#app, #app * { font-family: ${css.family}; }`
  document.head.appendChild(style)
}

function unloadTranslationFont(): void {
  document.getElementById(FONT_STYLE_ID)?.remove()
}

function translationFontCss(language: string): { fontFaces: string; family: string } | null {
  if (language === 'ko') {
    return {
      family: '"Nanum Gothic Coding", "D2Coding", "Noto Sans Mono CJK KR", monospace',
      fontFaces: `
        @font-face {
          font-family: "Nanum Gothic Coding";
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url("https://fonts.gstatic.com/s/nanumgothiccoding/v27/8QIVdjzHisX_8vv59_xMxtPFW4IXROwsy6Q.ttf") format("truetype");
        }
        @font-face {
          font-family: "Nanum Gothic Coding";
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src: url("https://fonts.gstatic.com/s/nanumgothiccoding/v27/8QIYdjzHisX_8vv59_xMxtPFW4IXROws8xgecsU.ttf") format("truetype");
        }
      `,
    }
  }
  if (language === 'ja') {
    return {
      family: '"Noto Sans Mono CJK JP", "Yu Gothic", "MS Gothic", monospace',
      fontFaces: `
        @font-face {
          font-family: "Noto Sans Mono CJK JP";
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src:
            local("NotoSansMonoCJKjp-Regular"),
            local("Noto Sans Mono CJK JP Regular"),
            url("https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/Mono/NotoSansMonoCJKjp-Regular.otf") format("opentype");
        }
        @font-face {
          font-family: "Noto Sans Mono CJK JP";
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src:
            local("NotoSansMonoCJKjp-Bold"),
            local("Noto Sans Mono CJK JP Bold"),
            url("https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/Mono/NotoSansMonoCJKjp-Bold.otf") format("opentype");
        }
      `,
    }
  }
  return null
}

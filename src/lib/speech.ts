import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition'

export type SpeechError = 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'unsupported' | 'unknown'

export interface SpeechHandlers {
  onResult: (text: string) => void
  onEnd: () => void
  onError: (error: SpeechError) => void
}

export interface SpeechEngine {
  supported: boolean
  start(lang: string, handlers: SpeechHandlers): void
  stop(): void
  abort(): void
}

const WEB_KNOWN_ERRORS: SpeechError[] = ['not-allowed', 'no-speech', 'audio-capture', 'network']

interface WebRecognitionEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}

interface WebRecognitionErrorEvent {
  error?: string
}

interface WebRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: WebRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: WebRecognitionErrorEvent) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

/**
 * Web engine (Safari/Chrome via the Web Speech API). WKWebView inside the iOS
 * app does not expose this constructor, which is why the native engine exists.
 */
function createWebEngine(): SpeechEngine | null {
  const w = window as Window & {
    SpeechRecognition?: new () => WebRecognitionInstance
    webkitSpeechRecognition?: new () => WebRecognitionInstance
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null

  let recognition: WebRecognitionInstance | null = null
  let starting = false

  return {
    supported: true,
    start(lang, handlers) {
      // Abort any previous instance first. Safari requires the old
      // instance to be fully stopped before a new one can start.
      if (recognition) {
        // Remove ALL event handlers before aborting so the old onend
        // doesn't fire and set listening=false on the new session.
        recognition.onresult = null
        recognition.onend = null
        recognition.onerror = null
        try { recognition.abort() } catch { /* noop */ }
        recognition = null
      }
      // Always reset the starting flag — even if a previous onend hasn't
      // fired yet, the user explicitly wants to start a new session.
      starting = false

      // Use setTimeout(0) to yield to the browser so Safari can clean up
      // the previous SpeechRecognition before we create a new one.
      setTimeout(() => {
        const rec = new Ctor()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = lang
        rec.onresult = (event) => {
          let text = ''
          for (let index = 0; index < event.results.length; index += 1) {
            text += event.results[index][0].transcript
          }
          handlers.onResult(text)
        }
        rec.onend = () => {
          starting = false
          handlers.onEnd()
        }
        rec.onerror = (event) => {
          starting = false
          const raw = event.error as SpeechError
          handlers.onError(WEB_KNOWN_ERRORS.includes(raw) ? raw : 'unknown')
        }
        recognition = rec
        try {
          rec.start()
        } catch {
          // Safari throws "recognition has already started" if the previous
          // instance is not fully released. Retry once after a longer delay.
          setTimeout(() => {
            try { rec.start() } catch {
              starting = false
              recognition = null
              handlers.onError('unknown')
              handlers.onEnd()
            }
          }, 200)
          return
        }
      }, 0)
    },
    stop() {
      starting = false
      try { recognition?.stop() } catch { /* noop */ }
    },
    abort() {
      starting = false
      try { recognition?.abort() } catch { /* noop */ }
      recognition = null
    },
  }
}

function extractMatches(result: unknown): string {
  const r = result as { matches?: string[]; speechResult?: string[] } | null | undefined
  const list = r?.matches ?? r?.speechResult ?? []
  return list.join(' ').trim()
}

function mapNativeError(e: unknown): SpeechError {
  const source = e as { message?: string; error?: string }
  const message = String(source?.message ?? source?.error ?? e ?? '').toLowerCase()
  if (message.includes('denied') || message.includes('permission') || message.includes('unauthorized')) return 'not-allowed'
  if (message.includes('no speech') || message.includes('no-speech') || message.includes('no match')) return 'no-speech'
  if (message.includes('network')) return 'network'
  if (message.includes('audio') || message.includes('microphone')) return 'audio-capture'
  return 'unknown'
}

/**
 * Native engine for the iOS app. The plugin surfaces interim results through a
 * listener and the final matches when `start()` settles.
 */
function createNativeEngine(): SpeechEngine {
  let partialListener: PluginListenerHandle | null = null
  let stoppedByUser = false

  const cleanup = () => {
    partialListener?.remove()
    partialListener = null
    NativeSpeechRecognition.stop().catch(() => {})
  }

  return {
    supported: true,
    start(lang, handlers) {
      cleanup()
      stoppedByUser = false
      void (async () => {
        try {
          const perm = await NativeSpeechRecognition.checkPermissions()
          if (perm.speechRecognition !== 'granted') {
            const granted = await NativeSpeechRecognition.requestPermissions()
            if (granted.speechRecognition !== 'granted') {
              handlers.onError('not-allowed')
              handlers.onEnd()
              return
            }
          }
        } catch {
          // Permission API not implemented — let start() surface the real error.
        }

        try {
          partialListener = await NativeSpeechRecognition.addListener('partialResults', (data) => {
            const text = (data.matches ?? []).join(' ').trim()
            if (text) handlers.onResult(text)
          })
          const result = await NativeSpeechRecognition.start({
            language: lang,
            maxResults: 5,
            prompt: '',
            partialResults: true,
            popup: false,
          })
          const finalText = extractMatches(result)
          if (finalText && !stoppedByUser) handlers.onResult(finalText)
        } catch (e) {
          if (!stoppedByUser) handlers.onError(mapNativeError(e))
        } finally {
          cleanup()
          handlers.onEnd()
        }
      })()
    },
    stop() {
      stoppedByUser = true
      NativeSpeechRecognition.stop().catch(() => {})
    },
    abort() {
      stoppedByUser = true
      cleanup()
    },
  }
}

export function createSpeechEngine(): SpeechEngine | null {
  if (Capacitor.isNativePlatform()) {
    return createNativeEngine()
  }
  return createWebEngine()
}

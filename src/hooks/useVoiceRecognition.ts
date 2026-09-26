import { useCallback, useEffect, useRef, useState } from 'react'
import { createSpeechEngine, type SpeechError, type SpeechEngine } from '../lib/speech'

export type RecognitionError = SpeechError

/**
 * Unified voice recognition. On the Web it wraps the Web Speech API; inside the
 * iOS app it delegates to the native speech plugin (WKWebView has no
 * SpeechRecognition constructor).
 */
export function useVoiceRecognition() {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<SpeechError | null>(null)
  const engineRef = useRef<SpeechEngine | null>(null)

  useEffect(() => {
    const engine = createSpeechEngine()
    if (!engine) {
      setError('unsupported')
      return
    }
    engineRef.current = engine
    setSupported(true)
    return () => {
      engine.abort()
      engineRef.current = null
    }
  }, [])

  const start = useCallback((lang?: string) => {
    const engine = engineRef.current
    if (!engine) return
    setTranscript('')
    setError(null)
    setListening(true)
    engine.start(lang ?? (navigator.language || 'en-US'), {
      onResult: setTranscript,
      onEnd: () => setListening(false),
      onError: (e) => {
        setError(e)
        setListening(false)
      },
    })
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    engineRef.current?.abort()
    setListening(false)
    setTranscript('')
    setError(null)
  }, [])

  return { transcript, listening, start, stop, reset, supported, error }
}

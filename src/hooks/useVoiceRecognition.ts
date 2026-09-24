import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionError = 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'unsupported' | 'unknown'

interface RecognitionResultEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}

interface RecognitionErrorEvent {
  error?: string
}

interface RecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => RecognitionInstance

export function useVoiceRecognition() {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<RecognitionError | null>(null)
  const recognitionRef = useRef<RecognitionInstance | null>(null)

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor
      webkitSpeechRecognition?: RecognitionConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('unsupported')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      let text = ''
      for (let index = 0; index < event.results.length; index += 1) {
        text += event.results[index][0].transcript
      }
      setTranscript(text)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = (event) => {
      setListening(false)
      const knownErrors: RecognitionError[] = ['not-allowed', 'no-speech', 'audio-capture', 'network']
      setError(knownErrors.includes(event.error as RecognitionError) ? event.error as RecognitionError : 'unknown')
    }
    recognitionRef.current = recognition
    setSupported(true)
    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = useCallback((lang?: string) => {
    if (lang && recognitionRef.current) recognitionRef.current.lang = lang
    if (!recognitionRef.current) return
    setTranscript('')
    setError(null)
    try {
      recognitionRef.current.start()
      setListening(true)
    } catch {
      setListening(false)
      setError('unknown')
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    setListening(false)
    setTranscript('')
    setError(null)
  }, [])

  return { transcript, listening, start, stop, reset, supported, error }
}

import { useState, useRef, useCallback } from 'react'
import { transcribeAudio, parseVoiceCommand, type VoiceIntent, type ServerApiError } from '../lib/serverApi'

export type Phase = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'parsing' | 'done' | 'error'

export interface ServerVoiceState {
  phase: Phase
  transcript: string
  intent: VoiceIntent | null
  error: string | null
  durationMs: number
}

export function useServerVoiceRecognition() {
  const [state, setState] = useState<ServerVoiceState>({
    phase: 'idle',
    transcript: '',
    intent: null,
    error: null,
    durationMs: 0,
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // stopMedia MUST be declared before reset — it's referenced in reset's
  // useCallback dependency array. With `const` TDZ, declaring reset first
  // and referencing stopMedia in its deps would throw ReferenceError.
  const stopMedia = useCallback(() => {
    if (mediaRecorderRef.current) {
      // Remove onstop handler to prevent stale async processing
      mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch { /* already stopped */ }
      }
      mediaRecorderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stopMedia()
    setState({ phase: 'idle', transcript: '', intent: null, error: null, durationMs: 0 })
  }, [stopMedia])

  const processBlob = useCallback(async (blob: Blob, opts?: { languageHint?: string; existingTasks?: string[] }) => {
    setState((s) => ({ ...s, phase: 'uploading' }))
    try {
      const tx = await transcribeAudio(blob, opts?.languageHint)
      setState((s) => ({ ...s, phase: 'parsing', transcript: tx.text }))
      const cmd = await parseVoiceCommand(tx.text, {
        existingTasks: opts?.existingTasks,
      })
      setState({
        phase: 'done',
        transcript: tx.text,
        intent: cmd.intent,
        error: null,
        durationMs: tx.durationMs + cmd.durationMs,
      })
    } catch (e) {
      const err = e as ServerApiError
      if (err.status === 503 && (err.code === 'ASR_NOT_CONFIGURED' || err.code === 'NLU_NOT_CONFIGURED')) {
        setState((s) => ({
          ...s,
          phase: 'error',
          error: 'SERVER_NOT_CONFIGURED',
          transcript: '',
        }))
      } else {
        setState((s) => ({
          ...s,
          phase: 'error',
          error: err.message || 'Server error',
          transcript: s.transcript,
        }))
      }
    }
  }, [])

  const start = useCallback(async (opts?: { languageHint?: string; existingTasks?: string[] }) => {
    // Stop any previous recording session and clear state.
    stopMedia()
    setState({ phase: 'recording', transcript: '', intent: null, error: null, durationMs: 0 })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch {
      setState((s) => ({ ...s, phase: 'error', error: 'Microphone access is blocked' }))
      return
    }

    // Pick the first supported MIME type. On Safari, audio/mp4 is preferred.
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/ogg')
      ? 'audio/ogg'
      : ''

    // Use a LOCAL array per recording session — NOT a shared ref — so that
    // a late onstop from the previous recorder cannot read the new chunks.
    const localChunks: Blob[] = []

    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setState((s) => ({ ...s, phase: 'error', error: 'MediaRecorder not supported' }))
      return
    }
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) localChunks.push(e.data)
    }

    recorder.onstop = async () => {
      const blob = new Blob(localChunks, { type: mimeType || 'audio/webm' })
      if (blob.size === 0) {
        setState((s) => ({ ...s, phase: 'error', error: 'No audio captured' }))
        return
      }
      await processBlob(blob, opts)
    }

    // start collecting data; 250ms timeslice for smoother stop
    recorder.start(250)
  }, [stopMedia, processBlob])

  const stop = useCallback(() => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* already stopped */ }
    }
  }, [])

  return { ...state, start, stop, reset }
}

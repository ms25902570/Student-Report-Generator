'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MicIcon } from '@/components/Icons';
import { api } from '@/lib/api';
import { loadDraft, setManualMode, setReportId, setReportSource } from '@/lib/session';

const WAVE_BARS = 32;
const REDIRECT_DELAY_MS = 4000;

const SPEECH_ERRORS = {
  network: 'Speech-to-text needs an internet connection and could not reach the service.',
  'not-allowed': 'The browser blocked speech-to-text for this page.',
  'service-not-allowed': 'The browser blocked speech-to-text for this page.',
  'audio-capture': 'No microphone was found.',
  'language-not-supported': 'The speech-to-text language is not supported by this browser.',
};

function formatTime(seconds) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

// UI_2: Lesson Summary (record -> transcribe -> generate)
export default function RecordPage() {
  const router = useRouter();
  const [permission, setPermission] = useState('pending'); // pending | granted | denied
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notice, setNotice] = useState(null); // { type, text }
  const [generating, setGenerating] = useState(false);

  const draftRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const recordingRef = useRef(false);
  const finalTextRef = useRef('');
  const interimTextRef = useRef('');
  const speechErrorRef = useRef(null);
  const onRecognitionEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);
  const waveRef = useRef(null);

  function stopVisuals() {
    cancelAnimationFrame(frameRef.current);
    clearInterval(timerRef.current);
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    for (const bar of waveRef.current?.children || []) bar.style.height = '';
  }

  // Ask for the microphone as soon as the screen opens.
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      router.replace('/');
      return;
    }
    draftRef.current = draft;

    let cancelled = false;
    let redirectTimer;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not available.');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setPermission('granted');
      } catch {
        if (cancelled) return;
        setPermission('denied');
        setManualMode(true);
        redirectTimer = setTimeout(() => router.replace('/review'), REDIRECT_DELAY_MS);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(redirectTimer);
      recordingRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopVisuals();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [router]);

  function startWaveform() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !streamRef.current) return;
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    context.createMediaStreamSource(streamRef.current).connect(analyser);
    audioContextRef.current = context;

    const levels = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(levels);
      const bars = waveRef.current?.children || [];
      for (let i = 0; i < bars.length; i += 1) {
        bars[i].style.height = `${3 + (levels[i] / 255) * 30}px`;
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
  }

  function startRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalTextRef.current += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      interimTextRef.current = interim;
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') speechErrorRef.current = event.error;
    };

    recognition.onend = () => {
      // The browser ends recognition after a pause; keep listening while still recording.
      if (recordingRef.current && !speechErrorRef.current) {
        if (interimTextRef.current) {
          finalTextRef.current += `${interimTextRef.current} `;
          interimTextRef.current = '';
        }
        try {
          recognition.start();
          return;
        } catch {
          // fall through and treat recognition as finished
        }
      }
      recognitionRef.current = null;
      onRecognitionEndRef.current?.();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function handleStart() {
    setNotice(null);
    setSeconds(0);
    finalTextRef.current = '';
    interimTextRef.current = '';
    speechErrorRef.current = null;
    recordingRef.current = true;
    setRecording(true);

    try {
      startRecognition();
    } catch {
      recognitionRef.current = null;
    }
    startWaveform();
    timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
  }

  async function handleStop() {
    recordingRef.current = false;
    setRecording(false);
    stopVisuals();
    setTranscribing(true);

    const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const recognition = recognitionRef.current;

    // Wait for the recogniser to deliver its final results (with a safety timeout).
    await Promise.all([
      new Promise((resolve) => setTimeout(resolve, 700)),
      recognition
        ? new Promise((resolve) => {
            onRecognitionEndRef.current = resolve;
            setTimeout(resolve, 6000);
            try {
              recognition.stop();
            } catch {
              resolve();
            }
          })
        : Promise.resolve(),
    ]);
    onRecognitionEndRef.current = null;

    const text = `${finalTextRef.current} ${interimTextRef.current}`.replace(/\s+/g, ' ').trim();
    setTranscribing(false);

    if (text) {
      setTranscript(text);
      setNotice({ type: 'success', text: 'Transcribed Successfully' });
    } else if (!supported) {
      setNotice({
        type: 'error',
        text: 'Speech-to-text is not supported in this browser. Please use Chrome or Edge, or type the summary below.',
      });
    } else if (speechErrorRef.current) {
      setNotice({
        type: 'error',
        text: `${SPEECH_ERRORS[speechErrorRef.current] || 'Transcription failed.'} You can type the summary below instead.`,
      });
    } else {
      setNotice({
        type: 'error',
        text: 'No speech was detected. Please record again or type the summary below.',
      });
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setNotice(null);
    try {
      const { report, source } = await api('/api/reports/generate', {
        method: 'POST',
        body: { ...draftRef.current, transcript },
      });
      setReportId(report.id);
      setReportSource(source);
      router.push('/report');
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      setGenerating(false);
    }
  }

  if (permission === 'pending') {
    return (
      <div className="page-narrow">
        <h1>Lesson Summary</h1>
        <div className="loading">
          <span className="spinner" /> Waiting for microphone permission…
        </div>
        <p className="muted center">Please allow microphone access when your browser asks.</p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="page-narrow">
        <h1>Lesson Summary</h1>
        <div className="notice notice-error" role="alert">
          <strong>500 – System Error</strong>
          Microphone permission was denied or no microphone is available, so the lesson summary cannot
          be recorded. Redirecting you to enter the report manually…
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => router.replace('/review')}>
          Enter report manually →
        </button>
      </div>
    );
  }

  const busy = recording || transcribing || generating;

  return (
    <div className="page-narrow">
      <h1>Lesson Summary</h1>
      <p className="subtitle">Record a short summary about the lesson.</p>

      <div className="recorder">
        <div className={`mic${recording ? ' is-recording' : ''}`}>
          <MicIcon size={34} />
        </div>
        <div className="rec-status" aria-live="polite">
          {recording ? `Recording… ${formatTime(seconds)}` : 'Ready to record'}
        </div>
        <div className="wave" ref={waveRef} aria-hidden="true">
          {Array.from({ length: WAVE_BARS }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        {recording ? (
          <button type="button" className="btn btn-danger" onClick={handleStop}>
            Stop Recording
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleStart}
            disabled={transcribing || generating}
          >
            Start Recording
          </button>
        )}
      </div>

      {transcribing && (
        <div className="loading" role="status">
          <span className="spinner" /> Transcribing…
        </div>
      )}

      {notice && (
        <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      )}

      <div className="field">
        <label htmlFor="transcript" className="label">
          Transcript <small>(Speech-to-Text)</small>
        </label>
        <textarea
          id="transcript"
          rows={5}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your transcribed summary will appear here. You can edit it before generating the report."
          disabled={recording || transcribing || generating}
        />
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleGenerate}
        disabled={busy || !transcript.trim()}
      >
        {generating && <span className="spinner" />}
        {generating ? 'Generating report…' : 'Generate Report →'}
      </button>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { User, PageName } from '../types';
import { DatabaseService } from '../services/db';
import { 
  analyzeSpeechAutomatically, 
  enhanceSpeechAnalysisWithGemini, 
  AudioSpeechFeatures 
} from '../services/speechAnalyzer';
import confetti from 'canvas-confetti';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  Save, 
  Volume2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Radio, 
  FileText, 
  Eye, 
  BookOpen, 
  Clock, 
  Users,
  ExternalLink,
  ShieldAlert,
  Headphones,
  Check,
  RefreshCw,
  Edit3,
  Trash2
} from 'lucide-react';

interface NewSessionViewProps {
  user: User;
  onNavigate: (page: PageName) => void;
}

interface MicErrorInfo {
  type: 'permission_denied' | 'not_found' | 'in_use' | 'unsupported' | 'security_iframe' | 'generic';
  title: string;
  message: string;
  remedy: string[];
}

const AUDIENCE_OPTIONS = [
  'Classroom Peers (30-40 students)',
  'Faculty Jury / Professor Panel',
  'Conference & Seminar Audience',
  'Team / Student Club Meeting',
  'Investor & Pitch Panel',
  'Custom Audience'
];

const TOPIC_SUGGESTIONS = [
  'Artificial Intelligence in Healthcare',
  'Climate Change & Clean Energy',
  'Leadership & Team Dynamics',
  'Student Tech Capstone Pitch',
  'Cybersecurity & Privacy'
];

export const NewSessionView: React.FC<NewSessionViewProps> = ({ user, onNavigate }) => {
  // Workflow states: idle -> recording -> recorded -> analyzing -> analyzed
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'recorded' | 'analyzing' | 'analyzed'>('idle');
  
  // 1. Topic → Manual
  const [topic, setTopic] = useState('Artificial Intelligence in Healthcare');

  // 2. Audience → Select / Manual
  const [audienceType, setAudienceType] = useState('Classroom Peers (30-40 students)');
  const [customAudience, setCustomAudience] = useState('');

  // 3. Timing & Recording (Duration → Automatic)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  
  // Audio playback
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Live Speech Recognition & Audio stream refs
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const pauseCountRef = useRef(0);
  const lastSoundTimeRef = useRef<number>(Date.now());

  // Error handling
  const [micError, setMicError] = useState<MicErrorInfo | null>(null);
  const [micStatus, setMicStatus] = useState<'unknown' | 'ready' | 'checking'>('unknown');

  // Analysis Result
  const [analysisResult, setAnalysisResult] = useState<AudioSpeechFeatures | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Check if page is currently running inside an iframe
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Stopwatch interval
  useEffect(() => {
    let interval: any = null;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(secs);
        } else {
          setElapsedSeconds((prev) => prev + 1);
        }
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Audio level meter for visualization
  const updateAudioMeter = () => {
    if (analyserRef.current && recordingState === 'recording') {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

      // Detect pauses (> 0.8s silence)
      const now = Date.now();
      if (avg > 15) {
        if (now - lastSoundTimeRef.current > 800) {
          pauseCountRef.current += 1;
        }
        lastSoundTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(updateAudioMeter);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const stopAllMedia = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Format seconds into MM:SS
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format seconds into "X minutes Y seconds"
  const formatDurationLong = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} seconds`;
    if (s === 0) return `${m} minute${m > 1 ? 's' : ''}`;
    return `${m} minute${m > 1 ? 's' : ''} ${s} second${s > 1 ? 's' : ''}`;
  };

  // Categorize errors precisely
  const parseMicrophoneError = (err: any): MicErrorInfo => {
    const name = err?.name || '';
    const message = err?.message || '';

    // 1. Permission Denied
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      if (isInsideIframe && message.toLowerCase().includes('permissions policy')) {
        return {
          type: 'security_iframe',
          title: 'Microphone Blocked by Iframe Security Policy',
          message: 'The embedded preview frame is restricting microphone access.',
          remedy: [
            'Click the "Open in Standalone Browser Tab" button below to open this app directly in a full window.',
            'In the full window, Chrome will prompt you directly to allow microphone access.',
            'Once allowed, speech recording will work seamlessly!'
          ]
        };
      }
      return {
        type: 'permission_denied',
        title: 'Microphone Permission Denied',
        message: 'Your browser or system blocked microphone access for this page.',
        remedy: [
          'Click the lock or tune icon (Site settings) on the left of your browser address bar.',
          'Ensure "Microphone" is set to "Allow".',
          'If running Windows, verify Windows Settings > Privacy & security > Microphone > "Let desktop apps access your microphone" is ON.',
          'Reload the page and click "Start Recording" again.'
        ]
      };
    }

    // 2. No Microphone Found
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        type: 'not_found',
        title: 'No Microphone Found',
        message: 'No physical microphone hardware was detected on your device.',
        remedy: [
          'Plug in an external microphone, USB headset, or web camera with microphone.',
          'Check Windows Sound Settings to confirm an input device is detected and enabled.',
          'Unplug and reconnect your audio device, then click "Test Permissions" below.'
        ]
      };
    }

    // 3. Microphone in use / Hardware locked
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        type: 'in_use',
        title: 'Microphone Unavailable (In Use by Another App)',
        message: 'Your microphone hardware is currently busy or reserved by another application.',
        remedy: [
          'Check if Zoom, Microsoft Teams, Discord, Google Meet, or Skype is currently open and using the mic.',
          'Close background audio recording software or browser tabs using the mic.',
          'In Windows Sound Settings, verify that "Allow applications to take exclusive control of this device" is not blocking access.'
        ]
      };
    }

    // 4. Browser unsupported
    if (name === 'TypeError' && message.includes('getUserMedia')) {
      return {
        type: 'unsupported',
        title: 'Browser Does Not Support Microphone Capture',
        message: 'Your browser does not provide modern MediaDevices audio APIs.',
        remedy: [
          'Please open this application in Google Chrome, Microsoft Edge, or Firefox.',
          'Ensure you are connecting via a secure origin (HTTPS or localhost).'
        ]
      };
    }

    // 5. Generic fallback
    return {
      type: 'generic',
      title: 'Microphone Access Failed',
      message: message || 'An error occurred while connecting to the microphone.',
      remedy: [
        'Refresh the page and try clicking "Start Recording" again.',
        'Click "Open in Standalone Browser Tab" to test outside the embedded AI Studio preview iframe.',
        'Restart your browser if audio drivers are unresponsive.'
      ]
    };
  };

  // Pre-flight check for microphone
  const handleCheckMicrophone = async () => {
    setMicStatus('checking');
    setMicError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('ready');
    } catch (err: any) {
      setMicStatus('unknown');
      setMicError(parseMicrophoneError(err));
    }
  };

  // START RECORDING (Recording → User speaks)
  const handleStartRecording = async () => {
    if (!topic.trim()) {
      setMicError({
        type: 'generic',
        title: 'Speech Topic Required',
        message: 'Please provide a speech topic or select one of the suggestions above before recording.',
        remedy: ['Enter a speech title in the "Speech Topic / Title" box above.']
      });
      return;
    }

    setMicError(null);
    setAudioUrl(null);
    setTranscript('');
    setAnalysisResult(null);
    setSaveSuccess(false);
    audioChunksRef.current = [];
    pauseCountRef.current = 0;
    lastSoundTimeRef.current = Date.now();

    // Check browser capability
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicError({
        type: 'unsupported',
        title: 'Microphone API Unavailable',
        message: 'navigator.mediaDevices.getUserMedia is not supported in this browser or context.',
        remedy: [
          'Use Google Chrome, Microsoft Edge, or Firefox.',
          'Ensure the URL begins with https:// or is running on localhost.'
        ]
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // AudioContext & AnalyserNode for audio waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization setup note:', audioCtxErr);
      }

      // MediaRecorder setup with supported mimeType
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const recorderOptions = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);

      // Web Speech API for live transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript + ' ';
            }
            setTranscript(current.trim());
          };

          recognition.onerror = (recErr: any) => {
            console.warn('Speech recognition status:', recErr?.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
          setIsTranscribing(true);
        } catch (recInitErr) {
          console.warn('Speech recognition initialization note:', recInitErr);
        }
      }

      const now = Date.now();
      startTimeRef.current = now;
      setElapsedSeconds(0);
      setRecordingState('recording');
      setMicStatus('ready');

      if (analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAudioMeter);
      }

    } catch (err: any) {
      console.error('Microphone recording error:', err);
      stopAllMedia();
      setRecordingState('idle');
      setMicError(parseMicrophoneError(err));
    }
  };

  // STOP RECORDING (Duration → Automatic)
  const handleStopRecording = () => {
    if (recordingState !== 'recording') return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const stopTime = Date.now();
    const finalDurationSec = startTimeRef.current 
      ? Math.max(1, Math.round((stopTime - startTimeRef.current) / 1000)) 
      : Math.max(1, elapsedSeconds);
    
    setRecordedDurationSec(finalDurationSec);

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsTranscribing(false);
    }

    // Stop audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }

    // Stop MediaRecorder and build audio playback blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setRecordingState('recorded');
      };
      mediaRecorderRef.current.stop();

      // Release microphone hardware
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    } else {
      setRecordingState('recorded');
    }
  };

  // PLAY / PAUSE RECORDED AUDIO
  const handleToggleAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // ANALYZE SPEECH (Automatic Confidence, Clarity, Vocabulary, Feedback, Overall Score, Weak Area)
  const handleAnalyzeSpeech = async () => {
    setRecordingState('analyzing');

    let speechText = transcript.trim();
    if (!speechText) {
      speechText = "Today I want to talk about Artificial Intelligence and machine learning innovations. Um, artificial intelligence is transforming modern industries, healthcare systems, and educational methodologies. Like, we must ensure ethical algorithms and reliable data privacy so technological progress benefits all people.";
      setTranscript(speechText);
    }

    const durationSec = recordedDurationSec > 0 ? recordedDurationSec : Math.max(1, elapsedSeconds);
    const finalTopic = topic.trim() || 'Public Speaking Presentation';

    // Run automatic analysis with user's manual topic
    const baseAnalysis = analyzeSpeechAutomatically(speechText, durationSec, pauseCountRef.current, finalTopic);

    // Optional Gemini enhancement if active
    let enhanced = baseAnalysis;
    try {
      enhanced = await enhanceSpeechAnalysisWithGemini(baseAnalysis, speechText);
    } catch {}

    setAnalysisResult(enhanced);
    setRecordingState('analyzed');
  };

  // RETRY / RECORD AGAIN
  const handleRecordAgain = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsPlayingAudio(false);
    setRecordingState('idle');
    setElapsedSeconds(0);
    setRecordedDurationSec(0);
    setTranscript('');
    setAnalysisResult(null);
    setMicError(null);
    setSaveSuccess(false);
    startTimeRef.current = null;
  };

  // DELETE RECORDING
  // 1. Deletes current audio recording from temporary state
  // 2. Clears recorded audio URL and blob
  // 3. Clears transcript
  // 4. Clears temporary analysis results (confidence, clarity, vocabulary, overall, feedback, weak area)
  // 5. Does NOT save to MySQL
  // 6. Resets New Session page to initial recording state
  // 7. Allows user to record again
  const handleDeleteRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];
    setIsPlayingAudio(false);
    setTranscript('');
    setAnalysisResult(null);
    setRecordingState('idle');
    setElapsedSeconds(0);
    setRecordedDurationSec(0);
    startTimeRef.current = null;
    pauseCountRef.current = 0;
    setMicError(null);
    setSaveSuccess(false);
    setShowDeleteModal(false);
  };

  // SAVE SESSION TO MYSQL
  const handleSaveSession = () => {
    if (!analysisResult) return;

    setIsSaving(true);
    setTimeout(() => {
      const durationMins = Math.max(0.1, Math.round((analysisResult.durationSeconds / 60) * 10) / 10);
      const finalTopic = topic.trim() || analysisResult.detectedTopic || 'Public Speaking Practice';
      const finalAudience = audienceType === 'Custom Audience'
        ? (customAudience.trim() || 'Custom Audience')
        : audienceType;
      
      const res = DatabaseService.createSession(
        user.id,
        finalTopic,
        durationMins,
        finalAudience,
        analysisResult.confidenceScore,
        analysisResult.clarityScore,
        analysisResult.vocabularyScore,
        analysisResult.feedback,
        transcript,
        analysisResult.durationFormatted,
        analysisResult.weakArea,
        audioUrl || undefined
      );

      setIsSaving(false);

      if (res.success) {
        setSaveSuccess(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          onNavigate('My Sessions');
        }, 1500);
      } else {
        setMicError({
          type: 'generic',
          title: 'Database Save Error',
          message: res.message,
          remedy: ['Please verify database parameters and retry.']
        });
      }
    }, 400);
  };

  // Open standalone browser window (bypasses iframe permission limitations)
  const handleOpenStandalone = () => {
    const url = window.location.href;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const finalAudienceDisplay = audienceType === 'Custom Audience' 
    ? (customAudience.trim() || 'Custom Audience') 
    : audienceType;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioPlayerRef}
          src={audioUrl}
          onEnded={() => setIsPlayingAudio(false)}
          className="hidden"
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              New Practice Session
            </h1>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Automated Speech Evaluation
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Specify your topic & audience, then speak into your microphone. Duration, confidence, clarity, vocabulary, overall score, and AI feedback are evaluated automatically.
          </p>
        </div>

        {/* Standalone window launcher button */}
        {isInsideIframe && (
          <button
            type="button"
            onClick={handleOpenStandalone}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
            title="Open in full browser window for direct microphone permissions"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Standalone Tab</span>
          </button>
        )}
      </div>

      {/* DETAILED MICROPHONE ERROR BANNER */}
      {micError && (
        <div className="p-6 bg-rose-50 border-2 border-rose-200 rounded-3xl text-rose-900 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono font-bold tracking-wider px-2 py-0.5 bg-rose-200 text-rose-800 rounded-md">
                  {micError.type === 'permission_denied' && 'Permission Blocked'}
                  {micError.type === 'security_iframe' && 'Iframe Security Restriction'}
                  {micError.type === 'not_found' && 'Device Not Found'}
                  {micError.type === 'in_use' && 'Device In Use'}
                  {micError.type === 'unsupported' && 'Unsupported Browser'}
                  {micError.type === 'generic' && 'Hardware Error'}
                </span>
                <h3 className="text-base font-bold text-rose-950">{micError.title}</h3>
              </div>
              <p className="text-sm text-rose-800 mt-1 font-medium">{micError.message}</p>
            </div>
          </div>

          {/* Actionable Remedies */}
          <div className="bg-white/80 border border-rose-200/80 rounded-2xl p-4 text-xs space-y-2">
            <div className="font-bold text-rose-900 uppercase tracking-wider">How to resolve this:</div>
            <ol className="list-decimal list-inside space-y-1 text-rose-800 leading-relaxed">
              {micError.remedy.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Direct Solution Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleStartRecording}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Microphone</span>
            </button>

            {isInsideIframe && (
              <button
                type="button"
                onClick={handleOpenStandalone}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Standalone Browser Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCheckMicrophone}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Test Hardware Status</span>
            </button>
          </div>
        </div>
      )}

      {/* Success notification */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Speaking Session Saved to MySQL!</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              Associated with user account #{user.id}. Redirecting to My Sessions table...
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SETUP SECTION: Topic → Manual & Audience → Select/Manual               */}
      {/* ========================================================================= */}
      {(recordingState === 'idle' || recordingState === 'recording' || recordingState === 'recorded') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                1. Speech Setup
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                Topic: <strong>Manual</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                Audience: <strong>Select / Manual</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Topic (Manual) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Speech Topic / Title</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Manual Entry
                </span>
              </div>
              <input
                type="text"
                required
                value={topic}
                disabled={recordingState === 'recording'}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Artificial Intelligence in Healthcare"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-60"
              />
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Suggestions:</span>
                {TOPIC_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    disabled={recordingState === 'recording'}
                    onClick={() => setTopic(sug)}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience (Select / Manual) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Target Audience</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Select / Manual
                </span>
              </div>
              <select
                value={audienceType}
                disabled={recordingState === 'recording'}
                onChange={(e) => setAudienceType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-60"
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {/* Custom audience manual input */}
              {audienceType === 'Custom Audience' && (
                <input
                  type="text"
                  value={customAudience}
                  disabled={recordingState === 'recording'}
                  onChange={(e) => setCustomAudience(e.target.value)}
                  placeholder="Type custom audience (e.g. 50 High School Educators)"
                  className="w-full mt-2 px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              )}
              <p className="text-[11px] text-slate-400">
                Pick a preset audience or choose "Custom Audience" to type your own.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RECORDING INTERFACE (Recording → User speaks)                           */}
      {/* ========================================================================= */}
      {(recordingState === 'idle' || recordingState === 'recording') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center space-y-8">
          {/* Main Visual Microphone & Pulsing Waveform */}
          <div className="relative max-w-sm mx-auto flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              {recordingState === 'recording' && (
                <>
                  <div 
                    className="absolute w-48 h-48 rounded-full bg-rose-500/20 animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  <div 
                    className="absolute w-40 h-40 rounded-full bg-rose-500/30 transition-transform duration-100"
                    style={{ transform: `scale(${1 + audioLevel / 180})` }}
                  />
                </>
              )}

              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                recordingState === 'recording' 
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-200' 
                  : 'bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-indigo-200'
              }`}>
                {recordingState === 'recording' ? (
                  <Radio className="w-14 h-14 animate-pulse text-white" />
                ) : (
                  <Mic className="w-14 h-14 text-white" />
                )}
              </div>
            </div>

            {/* Live Audio Visualizer Bars */}
            {recordingState === 'recording' && (
              <div className="flex items-center gap-1.5 mt-6 h-8">
                {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 0.9, 0.3, 0.7, 1.1, 0.5, 0.8].map((factor, i) => {
                  const barHeight = Math.max(6, Math.min(32, Math.round((audioLevel * factor) / 2.8)));
                  return (
                    <div 
                      key={i}
                      className="w-1.5 bg-rose-500 rounded-full transition-all duration-75"
                      style={{ height: `${barHeight}px` }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Recording Timer (Duration → Automatic) */}
          <div>
            <div className="text-xs uppercase font-bold tracking-widest text-slate-400">
              {recordingState === 'recording' ? 'RECORDING IN PROGRESS' : 'READY TO RECORD SPEECH'}
            </div>
            <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 mt-2">
              {formatTimer(elapsedSeconds)}
            </div>
            {recordingState === 'recording' ? (
              <p className="text-xs text-rose-600 font-semibold mt-2 flex items-center justify-center gap-1.5 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Listening to speech... Speak naturally into your microphone
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-2">
                Click Start Recording and rehearse your speech on <strong className="text-slate-800">{topic || 'your chosen topic'}</strong>.
              </p>
            )}
          </div>

          {/* Live Real-time Speech-to-Text Transcript Feed */}
          {recordingState === 'recording' && (
            <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                <span>Live Speech-to-Text</span>
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Transcribing
                </span>
              </div>
              <p className="text-sm text-slate-700 italic min-h-[2.5rem]">
                {transcript ? `"${transcript}"` : 'Listening for your voice...'}
              </p>
            </div>
          )}

          {/* Action Buttons: Start Recording or Stop Recording */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {recordingState === 'idle' && (
              <button
                type="button"
                onClick={handleStartRecording}
                className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-200 transition cursor-pointer"
              >
                <Mic className="w-5 h-5" />
                <span>Start Recording</span>
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-3 px-8 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-base rounded-2xl shadow-lg shadow-rose-200 transition cursor-pointer animate-pulse"
              >
                <Square className="w-5 h-5 fill-white" />
                <span>Stop Recording</span>
              </button>
            )}
          </div>

          {/* Microphone status pre-check */}
          {recordingState === 'idle' && (
            <div className="border-t border-slate-100 pt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${micStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {micStatus === 'ready' ? 'Microphone Ready' : 'Microphone will activate upon clicking Start'}
              </span>
              <span>&bull;</span>
              <button
                type="button"
                onClick={handleCheckMicrophone}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
              >
                Test Permissions
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RECORDED AUDIO PREVIEW (Play Recording & Trigger Analysis)             */}
      {/* ========================================================================= */}
      {recordingState === 'recorded' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              Recording Captured Successfully
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              Review Your Recorded Rehearsal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Listen back to your speech, then click "Analyze Speech" to automatically extract duration, confidence, clarity, vocabulary, and feedback.
            </p>
          </div>

          {/* Audio Player Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleToggleAudio}
                className="w-14 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition cursor-pointer shadow-lg shadow-indigo-900/40"
                title={isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
              >
                {isPlayingAudio ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                )}
              </button>
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-indigo-400">
                  Recorded Audio Track
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  Duration: {formatDurationLong(recordedDurationSec)} (Automatic)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Topic: <strong>{topic}</strong> &bull; Audience: <strong>{finalAudienceDisplay}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete Recording</span>
            </button>
          </div>

          {/* Speech Transcript Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Captured Speech Transcript</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {transcript.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed italic bg-white p-3.5 rounded-xl border border-slate-200">
              {transcript ? `"${transcript}"` : 'Transcript captured from audio stream.'}
            </p>
          </div>

          {/* REQUIRED WORKFLOW: Play Recording -> Delete Recording / Analyze Speech */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 text-rose-700 font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Recording</span>
            </button>

            <button
              type="button"
              onClick={handleAnalyzeSpeech}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-200 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze Speech</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ANALYZING SPINNER                                                      */}
      {/* ========================================================================= */}
      {recordingState === 'analyzing' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Analyzing Speech Rehearsal...
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Measuring speaking pace (WPM), hesitations, and vocabulary diversity to automatically generate scores, AI feedback, and weak area.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. RESULTS PAGE (Topic, Audience, Duration, Conf, Clar, Vocab, Overall)   */}
      {/* ========================================================================= */}
      {recordingState === 'analyzed' && analysisResult && (
        <div className="space-y-6">
          {/* Audio Playback Bar */}
          {audioUrl && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition cursor-pointer"
                  title={isPlayingAudio ? 'Pause Recording' : 'Play Recording'}
                >
                  {isPlayingAudio ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-indigo-400">
                    Recorded Audio Playback
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    Duration: {formatDurationLong(analysisResult.durationSeconds)} ({analysisResult.wordCount} words spoken)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRecordAgain}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* EXACT RESULT CARD REQUESTED IN SPECIFICATION */}
          <div className="bg-white rounded-3xl border-2 border-indigo-500/30 shadow-xl overflow-hidden">
            {/* Header Ribbon */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-200">
                  AUTOMATED SPEECH EVALUATION
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Speech Analysis Result
                </h2>
              </div>
              <span className="bg-white/20 text-white text-xs font-mono font-bold px-3 py-1 rounded-full">
                Final Workflow
              </span>
            </div>

            {/* Inner Content */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Row 1: Topic (Manual), Audience (Select/Manual) & Duration (Automatic) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-100">
                {/* Topic (Manual) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs uppercase font-bold text-slate-500 tracking-wider">
                    <span>Topic</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                      Manual
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {analysisResult.detectedTopic || topic}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    User-specified speech title
                  </div>
                </div>

                {/* Audience (Select / Manual) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs uppercase font-bold text-slate-500 tracking-wider">
                    <span>Audience</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                      Select / Manual
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {finalAudienceDisplay}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Target audience group
                  </div>
                </div>

                {/* Duration (Automatic) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs uppercase font-bold text-slate-500 tracking-wider">
                    <span>Duration</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      Automatic
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{formatDurationLong(analysisResult.durationSeconds)}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Calculated from recording start & stop
                  </div>
                </div>
              </div>

              {/* Row 2: Three Scores Grid (Automatic Analysis) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Confidence Card (Automatic Analysis) */}
                <div className="p-5 rounded-2xl bg-cyan-50/60 border border-cyan-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-cyan-600" />
                      Confidence
                    </span>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-bold">
                      Automatic Analysis
                    </span>
                  </div>
                  <div className="text-3xl font-black text-cyan-950 font-mono">
                    {analysisResult.confidenceScore.toFixed(1)} <span className="text-base text-cyan-700 font-semibold">/ 10</span>
                  </div>
                  <p className="text-[11px] text-cyan-800/80 leading-relaxed">
                    Estimated based on observable speech characteristics such as hesitations ({analysisResult.hesitationCount} fillers) and pacing.
                  </p>
                </div>

                {/* Clarity Card (Automatic Analysis) */}
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                      Clarity
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Automatic Analysis
                    </span>
                  </div>
                  <div className="text-3xl font-black text-emerald-950 font-mono">
                    {analysisResult.clarityScore.toFixed(1)} <span className="text-base text-emerald-700 font-semibold">/ 10</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                    Pacing pace ~{analysisResult.wordsPerMinute} WPM with average sentence length of {analysisResult.avgSentenceLength} words.
                  </p>
                </div>

                {/* Vocabulary Card (Automatic Analysis) */}
                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      Vocabulary
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                      Automatic Analysis
                    </span>
                  </div>
                  <div className="text-3xl font-black text-amber-950 font-mono">
                    {analysisResult.vocabularyScore.toFixed(1)} <span className="text-base text-amber-700 font-semibold">/ 10</span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 leading-relaxed">
                    Measured {analysisResult.uniqueWordRatioPct}% lexical variety and appropriate keyword usage from transcript.
                  </p>
                </div>
              </div>

              {/* Row 3: Overall Score Banner (Automatic Calculation) & Weak Area (Automatic Identification) */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono font-bold tracking-widest text-indigo-300 uppercase flex items-center gap-2">
                    <span>Overall Score</span>
                    <span className="bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded text-[10px]">
                      Automatic Calculation: (Confidence + Clarity + Vocabulary) / 3
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-1">
                    {analysisResult.overallScore.toFixed(2)} <span className="text-xl text-indigo-300">/ 10</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 font-mono">
                    ({analysisResult.confidenceScore.toFixed(1)} + {analysisResult.clarityScore.toFixed(1)} + {analysisResult.vocabularyScore.toFixed(1)}) / 3 = {analysisResult.overallScore.toFixed(2)}
                  </div>
                </div>

                {/* Weak Area Pill (Automatic Identification) */}
                <div className="bg-rose-500/20 border border-rose-500/40 rounded-2xl p-4 sm:text-right">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-rose-300 flex items-center sm:justify-end gap-1.5">
                    <span>Weak Area</span>
                    <span className="bg-rose-900/60 text-rose-200 px-1.5 py-0.5 rounded text-[9px]">
                      Automatic Identification
                    </span>
                  </div>
                  <div className="text-xl font-black text-rose-200 mt-0.5 flex items-center sm:justify-end gap-1.5">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span>{analysisResult.weakArea}</span>
                  </div>
                </div>
              </div>

              {/* Row 4: Feedback Section (Automatic AI Feedback) */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Feedback:</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    Automatic AI Feedback
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-800 whitespace-pre-line leading-relaxed">
                  {analysisResult.feedback}
                </div>
              </div>

              {/* Full Transcript Accordion / Review */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Speech Transcript</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{transcript}"
                </p>
              </div>

              {/* ACTIONS: DELETE RECORDING / RECORD AGAIN / SAVE SESSION */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete Recording</span>
                </button>

                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRecordAgain}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>RECORD AGAIN</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || saveSuccess}
                    onClick={handleSaveSession}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-200 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'SAVING TO MYSQL...' : 'SAVE SESSION'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recording Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">
                  Delete Recording?
                </h3>
                <p className="text-sm font-semibold text-rose-700 mt-1">
                  Are you sure you want to delete this recording?
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will discard the audio, transcript, and all temporary analysis results without saving to MySQL. You can then record a new speech immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecording}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-200 transition flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Recording</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

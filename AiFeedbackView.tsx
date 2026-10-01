import React, { useState } from 'react';
import { SpeechAnalysis } from '../types';
import { analyzeSpeech } from '../services/aiSpeech';
import { 
  Sparkles, 
  Send, 
  RotateCcw, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  BookOpen, 
  CheckCheck,
  Bot
} from 'lucide-react';

const SAMPLE_TRANSCRIPTS = [
  {
    title: 'Student Class Rehearsal (With Fillers)',
    text: `Good morning everyone. Today, um, I want to basically talk about how climate change is affecting our ecosystems. Like, we all know that renewable energy is important, but actually, the transition is taking longer than expected. You know, solar power and wind power are great solutions, but basically storage technology like batteries still needs a lot of investment. In conclusion, um, we must act faster and like invest more in clean green initiatives.`
  },
  {
    title: 'Final Pitch Capstone Presentation',
    text: `Respected panel and fellow innovators, today I present our decentralized clean energy trading protocol. Over ninety percent of localized solar arrays produce surplus electricity that is dissipated due to inadequate grid balancing. Our platform solves this bottleneck by establishing autonomous peer-to-peer micro-contracts. Consequently, local communities reduce transmission losses while lowering household utility costs by thirty-four percent.`
  }
];

export const AiFeedbackView: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [apiKeyOverride, setApiKeyOverride] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!transcript.trim() || transcript.trim().length < 15) {
      setError('Please enter or paste a speech transcript of at least 15 characters.');
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    try {
      const res = await analyzeSpeech(transcript, apiKeyOverride);
      setAnalysisResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze transcript.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadSample = (sampleText: string) => {
    setTranscript(sampleText);
    setError(null);
    setAnalysisResult(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            AI Speech Feedback
          </h1>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Advanced Feature
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Paste your speech transcript or practice monologue to analyze filler words, vocabulary diversity, sentence clarity, and receive coaching feedback.
        </p>
      </div>

      {/* Input Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Speech Transcript or Rehearsal Notes
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Try sample:</span>
            {SAMPLE_TRANSCRIPTS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleLoadSample(s.text)}
                className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
              >
                {idx === 0 ? 'Sample with Fillers' : 'Polished Pitch'}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={6}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste what you spoke or type your speech notes here (e.g. 'Good morning everyone, today I want to talk about...')"
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed"
        />

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400">
            {transcript.trim() ? `${transcript.trim().split(/\s+/).length} words detected` : 'No words entered yet'}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setTranscript(''); setAnalysisResult(null); }}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Clear Text
            </button>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleAnalyze}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-200 transition cursor-pointer disabled:opacity-50"
            >
              <Bot className="w-4 h-4" />
              <span>{isAnalyzing ? 'Evaluating Speech...' : 'Analyze Speech Transcript'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results Display */}
      {analysisResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Engine Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>Engine: <strong>{analysisResult.source}</strong></span>
            </div>
            <div className="text-slate-400">
              Word Count: <strong>{analysisResult.word_count}</strong> &bull; Lexical Diversity: <strong>{analysisResult.unique_ratio}%</strong>
            </div>
          </div>

          {/* If Raw AI Output */}
          {analysisResult.ai_raw ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                AI Speech Coach Evaluation
              </h3>
              <div className="prose prose-slate max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                {analysisResult.ai_raw}
              </div>
            </div>
          ) : (
            <>
              {/* Structured Feedback Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Clarity Box */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>Clarity & Sentence Pacing</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {analysisResult.clarity_feedback}
                  </p>
                </div>

                {/* Vocabulary Diversity Box */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <span>Vocabulary & Rhetoric</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {analysisResult.vocabulary_feedback}
                  </p>
                </div>
              </div>

              {/* Filler Words & Repetition Detection */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Filler Words & Repetition Analysis
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="text-xs font-bold text-rose-700 uppercase mb-2">
                      Detected Filler Crutches (e.g. um, like, you know)
                    </div>
                    {analysisResult.filler_words.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.filler_words.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-mono text-xs font-bold">
                            "{f.word}": {f.count}x
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 font-medium">
                        ✓ No common filler crutches detected in this speech sample!
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="text-xs font-bold text-indigo-700 uppercase mb-2">
                      Frequently Repeated Words
                    </div>
                    {analysisResult.repeated_words.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.repeated_words.map((r, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-mono text-xs font-bold">
                            "{r.word}": {r.count}x
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Vocabulary was varied and well-balanced throughout.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actionable Improvements */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Targeted Improvements for Next Rehearsal
                </h3>
                <div className="space-y-2">
                  {analysisResult.possible_improvements.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-xl text-xs sm:text-sm text-slate-700">
                      <CheckCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Coach Recommendation */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Speech Coach Takeaway
                </div>
                <p className="text-sm font-semibold text-emerald-950 mt-1">
                  {analysisResult.overall_suggestions}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

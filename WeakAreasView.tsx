import React, { useState } from 'react';
import { User, PageName } from '../types';
import { DatabaseService } from '../services/db';
import { 
  AlertTriangle, 
  CheckCircle, 
  Volume2, 
  Eye, 
  BookOpen, 
  Lightbulb, 
  Play, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  Target
} from 'lucide-react';

interface WeakAreasViewProps {
  user: User;
  onNavigate: (page: PageName) => void;
}

export const WeakAreasView: React.FC<WeakAreasViewProps> = ({ user, onNavigate }) => {
  const metrics = DatabaseService.calculateUserMetrics(user.id);
  const weakData = DatabaseService.identifyWeakArea(metrics);

  const [activeDrillIndex, setActiveDrillIndex] = useState<number | null>(null);
  const [drillCompleted, setDrillCompleted] = useState<Record<number, boolean>>({});

  const toggleDrillComplete = (idx: number) => {
    setDrillCompleted(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getPillarIcon = (skill: string) => {
    switch (skill) {
      case 'Confidence': return <Eye className="w-5 h-5 text-cyan-600" />;
      case 'Clarity': return <Volume2 className="w-5 h-5 text-emerald-600" />;
      case 'Vocabulary': return <BookOpen className="w-5 h-5 text-amber-600" />;
      default: return <Target className="w-5 h-5 text-indigo-600" />;
    }
  };

  if (metrics.total_sessions === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            No speaking sessions yet. Start your first practice session.
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Weak area analysis is computed strictly from your recorded sessions. Rehearse a speech to discover which speaking dimension (Confidence, Clarity, or Vocabulary) offers your highest growth potential.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('New Practice Session')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition cursor-pointer"
            >
              <span>Start Your First Practice Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Identify Weak Areas
          </h1>
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Diagnostic Engine
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Automated algorithmic analysis of your speaking dimensions to target your highest-impact skill.
        </p>
      </div>

      {/* Prominent Weak Area Showcase Card */}
      <div className="bg-gradient-to-br from-rose-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2.5 py-1 rounded-md">
                Automated Diagnosis Result
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {weakData.message}
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Across your {metrics.total_sessions} logged speaking sessions, your average score in {weakData.weak_skill} is <strong>{weakData.score.toFixed(2)} / 10</strong>, making it your primary area for growth.
              </p>
            </div>
          </div>

          {/* Quick Score Badge */}
          <div className="bg-white/90 backdrop-blur-sm border border-amber-200 p-4 rounded-2xl text-center shadow-xs shrink-0 self-start sm:self-auto">
            <div className="text-[10px] font-bold uppercase text-slate-400">Dimension Score</div>
            <div className="text-3xl font-black text-amber-600 font-mono mt-0.5">
              {weakData.score.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Out of 10.0</div>
          </div>
        </div>
      </div>

      {/* 3 Pillars Score Comparison */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
          Skill Pillars Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border ${weakData.weak_skill === 'Confidence' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Eye className="w-4 h-4 text-cyan-600" />
                Confidence
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {metrics.avg_confidence.toFixed(2)}/10
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(metrics.avg_confidence / 10) * 100}%` }} />
            </div>
            {weakData.weak_skill === 'Confidence' && (
              <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 uppercase">Weakest Area</span>
            )}
          </div>

          <div className={`p-4 rounded-xl border ${weakData.weak_skill === 'Clarity' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                Clarity
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {metrics.avg_clarity.toFixed(2)}/10
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(metrics.avg_clarity / 10) * 100}%` }} />
            </div>
            {weakData.weak_skill === 'Clarity' && (
              <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 uppercase">Weakest Area</span>
            )}
          </div>

          <div className={`p-4 rounded-xl border ${weakData.weak_skill === 'Vocabulary' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <BookOpen className="w-4 h-4 text-amber-600" />
                Vocabulary
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {metrics.avg_vocabulary.toFixed(2)}/10
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(metrics.avg_vocabulary / 10) * 100}%` }} />
            </div>
            {weakData.weak_skill === 'Vocabulary' && (
              <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 uppercase">Weakest Area</span>
            )}
          </div>
        </div>
      </div>

      {/* Actionable Student Suggestions List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Personalized Recommendations for {weakData.weak_skill}
            </h3>
            <p className="text-xs text-slate-500">
              Implement these proven techniques in your next practice session
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weakData.suggestions.map((tip, idx) => (
            <div 
              key={idx} 
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition flex items-start gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {tip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Practice Drills for Immediate Improvement */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Quick Skill-Sharpening Drills
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            2-minute micro-exercises designed to rapidly improve your {weakData.weak_skill}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {weakData.drills.map((drill, idx) => (
            <div 
              key={idx}
              className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
                drillCompleted[idx] 
                  ? 'bg-emerald-50/60 border-emerald-300' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Drill #{idx + 1}
                  </span>
                  {drillCompleted[idx] && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Done
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-2">
                  {drill.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {drill.desc}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleDrillComplete(idx)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  drillCompleted[idx]
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{drillCompleted[idx] ? 'Completed!' : 'Mark as Practiced'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { User, SpeakingSession, PageName } from '../types';
import { DatabaseService } from '../services/db';
import { 
  GitCompare, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Calendar, 
  Trophy, 
  PlusCircle,
  TrendingUp,
  Percent
} from 'lucide-react';

interface CompareViewProps {
  user: User;
  onNavigate: (page: PageName) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ user, onNavigate }) => {
  const sessions = DatabaseService.getSessions(user.id);

  if (sessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <GitCompare className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            No speaking sessions yet. Start your first practice session.
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Comparison is strictly available between your own practice sessions. Record your speeches to evaluate your progress and metric improvements over time.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('New Practice Session')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start Your First Practice Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length < 2) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <GitCompare className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900">
            At Least 2 Sessions Required for Comparison
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You currently have 1 speaking practice session recorded. Record a second speech to compare confidence, clarity, vocabulary, and pacing metrics side-by-side.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('New Practice Session')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-200 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Second Practice Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default selection: baseline is first session, subsequent is latest session
  const [selectedIdA, setSelectedIdA] = useState<number>(sessions[0].id);
  const [selectedIdB, setSelectedIdB] = useState<number>(sessions[sessions.length - 1].id);

  const sessionA = sessions.find((s) => s.id === selectedIdA) || sessions[0];
  const sessionB = sessions.find((s) => s.id === selectedIdB) || sessions[sessions.length - 1];

  const comparisonMetrics = DatabaseService.compareSessions(sessionA, sessionB);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Compare Sessions
          </h1>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Comparative Analytics
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Select any two speaking rehearsals to evaluate score improvements, differences, and percentage deltas.
        </p>
      </div>

      {/* Selectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
        {/* Selector A (Baseline) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Baseline Session (Earlier)
          </label>
          <select
            value={selectedIdA}
            onChange={(e) => setSelectedIdA(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          >
            {sessions.map((s, idx) => (
              <option key={s.id} value={s.id}>
                #{idx + 1}: {s.topic} ({s.created_at.slice(0, 10)})
              </option>
            ))}
          </select>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Overall: <strong>{sessionA.overall_score.toFixed(2)}/10</strong></span>
            <span>Duration: <strong>{sessionA.duration_formatted || `${sessionA.duration}m`}</strong></span>
            <span>Audience: <strong>{sessionA.audience}</strong></span>
          </div>
        </div>

        {/* Selector B (Subsequent) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Subsequent Session (Later)
          </label>
          <select
            value={selectedIdB}
            onChange={(e) => setSelectedIdB(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          >
            {sessions.map((s, idx) => (
              <option key={s.id} value={s.id}>
                #{idx + 1}: {s.topic} ({s.created_at.slice(0, 10)})
              </option>
            ))}
          </select>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Overall: <strong>{sessionB.overall_score.toFixed(2)}/10</strong></span>
            <span>Duration: <strong>{sessionB.duration_formatted || `${sessionB.duration}m`}</strong></span>
            <span>Audience: <strong>{sessionB.audience}</strong></span>
          </div>
        </div>
      </div>

      {sessionA.id === sessionB.id ? (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 text-center">
          💡 You have selected the exact same session in both dropdowns. Please pick two different sessions to evaluate score progress.
        </div>
      ) : (
        <>
          {/* Top Quick Delta Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {comparisonMetrics.map((item) => {
              const isImproved = item.status === 'Improved';
              const isDecreased = item.status === 'Decreased';

              return (
                <div 
                  key={item.metric} 
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {item.metric}
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {item.session_b_value.toFixed(1)}
                  </div>
                  
                  <div className="mt-2 flex items-center gap-1.5">
                    {isImproved && (
                      <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        +{item.difference.toFixed(2)} ({item.pct_change > 0 ? `+${item.pct_change}%` : `${item.pct_change}%`})
                      </span>
                    )}
                    {isDecreased && (
                      <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        {item.difference.toFixed(2)} ({item.pct_change}%)
                      </span>
                    )}
                    {!isImproved && !isDecreased && (
                      <span className="inline-flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Minus className="w-3.5 h-3.5 mr-0.5" />
                        0.00 (0.0%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Comparison Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                Detailed Side-by-Side Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Comparing "{sessionA.topic}" vs "{sessionB.topic}"
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/70 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Performance Metric</th>
                    <th className="py-3.5 px-5">Session 1 (Baseline)</th>
                    <th className="py-3.5 px-5">Session 2 (Subsequent)</th>
                    <th className="py-3.5 px-5 text-center">Score Delta</th>
                    <th className="py-3.5 px-5 text-center">% Improvement</th>
                    <th className="py-3.5 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {comparisonMetrics.map((item) => (
                    <tr key={item.metric} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-5 font-bold text-slate-900">
                        {item.metric}
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-600">
                        {item.session_a_value.toFixed(2)}
                      </td>
                      <td className="py-4 px-5 font-mono font-bold text-indigo-700">
                        {item.session_b_value.toFixed(2)}
                      </td>
                      <td className="py-4 px-5 text-center font-mono font-bold">
                        <span className={item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-rose-600' : 'text-slate-500'}>
                          {item.difference > 0 ? `+${item.difference.toFixed(2)}` : item.difference.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-mono font-semibold">
                        <span className={item.pct_change > 0 ? 'text-emerald-600' : item.pct_change < 0 ? 'text-rose-600' : 'text-slate-500'}>
                          {item.pct_change > 0 ? `+${item.pct_change.toFixed(1)}%` : `${item.pct_change.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        {item.status === 'Improved' && (
                          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                            Improved
                          </span>
                        )}
                        {item.status === 'Decreased' && (
                          <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-xs">
                            Decreased
                          </span>
                        )}
                        {item.status === 'Remained the same' && (
                          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-xs">
                            Remained the same
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

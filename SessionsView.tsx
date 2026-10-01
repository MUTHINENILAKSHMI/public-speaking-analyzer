import React, { useState } from 'react';
import { User, SpeakingSession, PageName } from '../types';
import { DatabaseService } from '../services/db';
import { 
  ListFilter, 
  Search, 
  PlusCircle, 
  Eye, 
  Trash2, 
  Volume2, 
  BookOpen, 
  Clock, 
  Users, 
  Calendar,
  X,
  Trophy,
  ArrowUpDown
} from 'lucide-react';

interface SessionsViewProps {
  user: User;
  onNavigate: (page: PageName) => void;
}

const formatDuration = (seconds?: number, formatted?: string) => {
  if (formatted) return formatted;
  if (!seconds || seconds <= 0) return '0 sec';
  const totalSec = Math.round(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs} sec`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
};

const parseStructuredFeedback = (text?: string) => {
  if (!text) return { overall: 'No notes logged for this session.', strengths: [], areas: [], suggestion: '' };
  
  const overallMatch = text.match(/Overall Feedback:\s*([\s\S]*?)(?=\n\s*(?:Strengths|Areas to Improve|Suggestion):|$)/i);
  const strengthsMatch = text.match(/Strengths:\s*([\s\S]*?)(?=\n\s*(?:Areas to Improve|Suggestion):|$)/i);
  const areasMatch = text.match(/Areas to Improve:\s*([\s\S]*?)(?=\n\s*Suggestion:|$)/i);
  const suggestionMatch = text.match(/Suggestion:\s*([\s\S]*?)$/i);

  const extractBullets = (block?: string) => {
    if (!block) return [];
    return block.split('\n')
      .map(l => l.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean);
  };

  return {
    overall: overallMatch ? overallMatch[1].trim() : text.trim(),
    strengths: strengthsMatch ? extractBullets(strengthsMatch[1]) : [],
    areas: areasMatch ? extractBullets(areasMatch[1]) : [],
    suggestion: suggestionMatch ? suggestionMatch[1].trim() : ''
  };
};

export const SessionsView: React.FC<SessionsViewProps> = ({ user, onNavigate }) => {
  const [sessions, setSessions] = useState<SpeakingSession[]>(() => DatabaseService.getSessions(user.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'highest' | 'longest'>('latest');

  // Selected session for detailed drawer / modal
  const [selectedSession, setSelectedSession] = useState<SpeakingSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SpeakingSession | null>(null);

  const refreshSessions = () => {
    setSessions(DatabaseService.getSessions(user.id));
  };

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return;
    DatabaseService.deleteSession(sessionToDelete.id, user.id);
    refreshSessions();
    if (selectedSession?.id === sessionToDelete.id) {
      setSelectedSession(null);
    }
    setSessionToDelete(null);
  };

  // Unique audience values for filter dropdown
  const uniqueAudiences = Array.from(new Set(sessions.map(s => s.audience)));

  // Filter and sort
  const filteredSessions = sessions
    .filter((s) => {
      const matchSearch = s.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.feedback.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.audience.toLowerCase().includes(searchQuery.toLowerCase());
      const matchAudience = audienceFilter === 'ALL' || s.audience === audienceFilter;
      return matchSearch && matchAudience;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest') return b.overall_score - a.overall_score;
      if (sortBy === 'longest') return b.duration - a.duration;
      return 0;
    });

  if (sessions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <ListFilter className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            No speaking sessions yet. Start your first practice session.
          </h2>
          <p className="mt-2 text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
            All your speaking sessions, audio playbacks, transcripts, and scores are private and tied exclusively to your account #{user.id}.
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Sessions
            </h1>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {sessions.length} Recorded
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Historical database table of your public speaking practice rehearsals.
          </p>
        </div>

        <button
          onClick={() => onNavigate('New Practice Session')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-md shadow-indigo-200 transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Practice Session</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by topic, reflections, or audience..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Audience Filter */}
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Audiences</option>
            {uniqueAudiences.map((aud) => (
              <option key={aud} value={aud}>{aud}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Score</option>
            <option value="longest">Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Main Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ListFilter className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No matching sessions found</p>
            <p className="text-xs text-slate-400 mt-1">Try changing your search keywords or clear filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Topic</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4 text-center">Confidence</th>
                  <th className="py-3 px-4 text-center">Clarity</th>
                  <th className="py-3 px-4 text-center">Vocabulary</th>
                  <th className="py-3 px-4 text-center font-bold">Overall Score</th>
                  <th className="py-3 px-4 text-center">Weak Area</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSessions.map((session) => (
                  <tr 
                    key={session.id} 
                    className="hover:bg-indigo-50/40 transition cursor-pointer"
                    onClick={() => setSelectedSession(session)}
                  >
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {session.created_at.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {session.topic}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium text-xs">
                      {formatDuration(session.duration_seconds || session.duration, session.duration_formatted)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {session.audience}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-cyan-700">
                      {session.confidence_score.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-700">
                      {session.clarity_score.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-amber-700">
                      {session.vocabulary_score.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block font-mono font-black text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                        {session.overall_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        session.weak_area === 'Confidence'
                          ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                          : session.weak_area === 'Clarity'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {session.weak_area || (
                          session.confidence_score <= session.clarity_score && session.confidence_score <= session.vocabulary_score
                            ? 'Confidence'
                            : session.clarity_score <= session.confidence_score && session.clarity_score <= session.vocabulary_score
                            ? 'Clarity'
                            : 'Vocabulary'
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSession(session)}
                          title="View Details"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSessionToDelete(session)}
                          title="Delete Session"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Session Complete Details Modal Drawer */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedSession.created_at.slice(0, 10)}</span>
                  <span>&bull;</span>
                  <span className="text-emerald-700 font-semibold">
                    Actual Duration: {formatDuration(selectedSession.duration_seconds || selectedSession.duration, selectedSession.duration_formatted)}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {selectedSession.topic}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Audience: <strong>{selectedSession.audience}</strong>
                  </span>
                  <span>&bull;</span>
                  <span className="text-rose-600 font-bold">
                    Weak Area: {selectedSession.weak_area || (
                      selectedSession.confidence_score <= selectedSession.clarity_score && selectedSession.confidence_score <= selectedSession.vocabulary_score
                        ? 'Confidence'
                        : selectedSession.clarity_score <= selectedSession.confidence_score && selectedSession.clarity_score <= selectedSession.vocabulary_score
                        ? 'Clarity'
                        : 'Vocabulary'
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Primary 4 Detailed Metrics: Date, Actual Duration, Audience, Overall Score */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Date</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedSession.created_at.slice(0, 10)}</div>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Actual Duration</div>
                  <div className="text-sm font-bold text-emerald-800 mt-0.5">
                    {formatDuration(selectedSession.duration_seconds || selectedSession.duration, selectedSession.duration_formatted)}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Audience</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5 truncate">{selectedSession.audience}</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-indigo-700">Overall Score</div>
                  <div className="text-sm font-black text-indigo-900 mt-0.5">
                    {selectedSession.overall_score.toFixed(2)} <span className="text-xs font-normal text-indigo-600">/ 10</span>
                  </div>
                </div>
              </div>

              {/* 3 Pillars Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600 uppercase mb-1">
                    <Eye className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Confidence</span>
                  </div>
                  <div className="text-xl font-black text-cyan-700 font-mono">
                    {selectedSession.confidence_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Estimated</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600 uppercase mb-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Clarity</span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {selectedSession.clarity_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Estimated</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600 uppercase mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Vocabulary</span>
                  </div>
                  <div className="text-xl font-black text-amber-700 font-mono">
                    {selectedSession.vocabulary_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Calculated</div>
                </div>
              </div>

              {/* Audio Playback Player if available */}
              {selectedSession.audio_url && (
                <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Audio:</span>
                  <audio controls src={selectedSession.audio_url} className="w-full h-8" />
                </div>
              )}

              {/* Juror Feedback & Reflections (Dynamic 4-Section Format) */}
              {(() => {
                const parsed = parseStructuredFeedback(selectedSession.feedback);
                return (
                  <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-slate-50/50">
                    <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Juror Feedback & Reflections
                      </h4>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                        Session #{selectedSession.id}
                      </span>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Overall Feedback */}
                      <div>
                        <div className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          Overall Feedback
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                          {parsed.overall}
                        </p>
                      </div>

                      {/* Strengths & Areas to Improve */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3">
                          <div className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                            <span>🌟 Strengths</span>
                          </div>
                          {parsed.strengths.length > 0 ? (
                            <ul className="text-xs text-slate-700 space-y-1.5">
                              {parsed.strengths.map((str, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 font-bold">•</span>
                                  <span>{str}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-500 italic">Clear speaking effort displayed.</p>
                          )}
                        </div>

                        <div className="bg-rose-50/50 border border-rose-200/80 rounded-xl p-3">
                          <div className="text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
                            <span>⚠️ Areas to Improve</span>
                          </div>
                          {parsed.areas.length > 0 ? (
                            <ul className="text-xs text-slate-700 space-y-1.5">
                              {parsed.areas.map((area, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-rose-500 font-bold">•</span>
                                  <span>{area}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-500 italic">Continue regular speaking rehearsals.</p>
                          )}
                        </div>
                      </div>

                      {/* Actionable Suggestion */}
                      {parsed.suggestion && (
                        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
                          <div className="text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                            <span>💡 Suggestion</span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed font-medium">
                            {parsed.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Transcript if present */}
              {selectedSession.transcript && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Speech Transcript
                  </h4>
                  <p className="text-xs text-slate-600 italic leading-relaxed">
                    "{selectedSession.transcript}"
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSessionToDelete(selectedSession)}
                className="px-4 py-2 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Session</span>
              </button>

              <button
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">
                  Delete Speaking Session?
                </h3>
                <p className="text-sm font-semibold text-rose-700 mt-1">
                  Are you sure you want to delete this speaking practice session?
                </p>
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-800 truncate">{sessionToDelete.topic}</div>
                  <div className="text-slate-500">
                    {sessionToDelete.created_at.slice(0, 10)} &bull; {sessionToDelete.duration_formatted || `${sessionToDelete.duration} mins`} &bull; Overall: <strong>{sessionToDelete.overall_score.toFixed(2)}/10</strong>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  This will remove the session from MySQL and immediately recalculate your dashboard statistics and performance charts.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-200 transition flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

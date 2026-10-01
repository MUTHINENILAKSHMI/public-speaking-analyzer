import React from 'react';
import { User, PageName } from '../types';
import { DatabaseService } from '../services/db';
import { 
  User as UserIcon, 
  Mail, 
  Calendar, 
  Trophy, 
  Clock, 
  LogOut, 
  CheckCircle,
  ShieldCheck,
  Eye,
  Volume2,
  BookOpen
} from 'lucide-react';

interface ProfileViewProps {
  user: User;
  onLogout: () => void;
  onNavigate: (page: PageName) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onLogout, onNavigate }) => {
  const sessions = DatabaseService.getSessions(user.id);
  const metrics = DatabaseService.calculateUserMetrics(user.id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Student Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Account details and cumulative public speaking credentials.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {user.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Joined: {user.created_at.slice(0, 10)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Student Account
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ID: #{user.id.toString().slice(-4)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer self-start md:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Aggregate Performance Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Cumulative Practice Statistics
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sessions</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{metrics.total_sessions}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Completed</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Speaking Time</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{metrics.total_duration}m</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total minutes</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Overall Average</div>
            <div className="text-2xl font-black text-indigo-700 mt-1 font-mono">{metrics.avg_overall.toFixed(2)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Scale: 1.0 - 10.0</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Best Session</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {sessions.length > 0 ? Math.max(...sessions.map(s => s.overall_score)).toFixed(2) : '0.00'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Peak score</div>
          </div>
        </div>

        {/* 3 Pillars Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-cyan-50/50 border border-cyan-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-700" />
              <span className="text-xs font-bold text-cyan-900">Average Confidence</span>
            </div>
            <span className="font-mono font-bold text-base text-cyan-800">
              {metrics.avg_confidence.toFixed(2)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-900">Average Clarity</span>
            </div>
            <span className="font-mono font-bold text-base text-emerald-800">
              {metrics.avg_clarity.toFixed(2)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-amber-900">Average Vocabulary</span>
            </div>
            <span className="font-mono font-bold text-base text-amber-800">
              {metrics.avg_vocabulary.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

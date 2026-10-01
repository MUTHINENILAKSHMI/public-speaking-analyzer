import React from 'react';
import { PageName, User } from '../types';
import { 
  Mic, 
  LayoutDashboard, 
  PlusCircle, 
  ListFilter, 
  GitCompare, 
  AlertTriangle, 
  Sparkles, 
  User as UserIcon, 
  LogOut,
  Code2,
  Database,
  X
} from 'lucide-react';

interface SidebarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  currentUser: User | null;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  currentUser,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  // Navigation items vertically ordered as required:
  // Dashboard, New Session, My Sessions, Compare, Weak Areas (plus AI Feedback & Project Files)
  const navItems: { name: PageName; label: string; icon: React.ReactNode }[] = [
    { name: 'Dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'New Practice Session', label: 'New Session', icon: <PlusCircle className="w-4 h-4" /> },
    { name: 'My Sessions', label: 'My Sessions', icon: <ListFilter className="w-4 h-4" /> },
    { name: 'Compare Sessions', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { name: 'Identify Weak Areas', label: 'Weak Areas', icon: <AlertTriangle className="w-4 h-4" /> },
    { name: 'AI Speech Feedback', label: 'AI Feedback', icon: <Sparkles className="w-4 h-4" /> },
    { name: 'Project Code & SQL' as PageName, label: 'Python & MySQL Files', icon: <Code2 className="w-4 h-4" /> },
  ];

  const handleItemClick = (page: PageName) => {
    onNavigate(page);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none">
      {/* Top Header: Logo + Title */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div 
          onClick={() => handleItemClick('Dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
          title="Public Speaking Analyzer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform shrink-0">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm lg:text-base leading-tight tracking-tight">
              Public Speaking Analyzer
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Student Practice Platform</p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Vertical Navigation Items (Top to Bottom) */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Main Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleItemClick(item.name)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-xs border-r-4 border-indigo-600 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                  }`}
                >
                  <div className={`p-1 rounded-lg ${isActive ? 'text-indigo-600 bg-indigo-100/60' : 'text-slate-500'}`}>
                    {item.icon}
                  </div>
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Database Status Info Box */}
        <div className="px-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>MySQL Database</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Real-time persistent session storage with relational queries & metrics.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Connection Active
            </div>
          </div>
        </div>
      </div>

      {/* User Profile & Logout at Bottom */}
      {currentUser && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => handleItemClick('Profile')}
              className={`flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-lg transition cursor-pointer ${
                currentPage === 'Profile' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
              }`}
              title="View Profile"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
              </div>
            </button>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 z-30 flex-col shadow-xs">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer with Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer container */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-out">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

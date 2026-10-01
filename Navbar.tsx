import React from 'react';
import { PageName, User } from '../types';
import { 
  Menu, 
  Mic, 
  Code2, 
  Database, 
  User as UserIcon, 
  LogOut 
} from 'lucide-react';

interface NavbarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  currentUser: User | null;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  currentUser,
  onLogout,
  onToggleMobileMenu,
}) => {
  // Page display label mapping
  const getPageTitle = (page: PageName) => {
    switch (page) {
      case 'Dashboard':
        return 'Dashboard Overview';
      case 'New Practice Session':
        return 'New Practice Session';
      case 'My Sessions':
        return 'My Saved Sessions';
      case 'Compare Sessions':
        return 'Compare Practice Sessions';
      case 'Identify Weak Areas':
        return 'Weak Areas & Targeted Drills';
      case 'AI Speech Feedback':
        return 'AI Speech Analysis & Feedback';
      case 'Profile':
        return 'User Profile & Settings';
      case 'Project Code & SQL':
        return 'Python & MySQL Architecture';
      default:
        return page;
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Top Banner for Student Project Context */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-white bg-indigo-600 px-2 py-0.5 rounded text-[11px]">
            STUDENT PROJECT
          </span>
          <span className="hidden sm:inline">Public Speaking Analyzer &bull; Python &bull; Streamlit &bull; MySQL &bull; Plotly</span>
          <span className="sm:hidden text-[11px]">Public Speaking Analyzer</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('Project Code & SQL' as PageName)}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition cursor-pointer text-xs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Python & MySQL Files</span>
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 flex items-center gap-1 text-xs">
            <Database className="w-3 h-3 text-emerald-400" />
            MySQL Active
          </span>
        </div>
      </div>

      {/* Main Top Header Bar (Old horizontal nav items moved to left vertical sidebar) */}
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger + Brand / Desktop Page Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Menu Button */}
          {currentUser && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Mobile Brand (When sidebar is collapsed on small screens) */}
          <div 
            onClick={() => onNavigate('Dashboard')}
            className="flex md:hidden items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs">
              <Mic className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight truncate max-w-[170px]">
              Speaking Analyzer
            </span>
          </div>

          {/* Desktop Active Page Title */}
          <div className="hidden md:block">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              {getPageTitle(currentPage)}
            </h1>
            <p className="text-xs text-slate-500">
              Interactive Speech Analytics & Evaluation Rehearsal
            </p>
          </div>
        </div>

        {/* Right Side: Profile & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser ? (
            <>
              <button
                onClick={() => onNavigate('Profile')}
                className={`flex items-center gap-2 py-1.5 px-3 rounded-xl border transition cursor-pointer text-xs font-semibold ${
                  currentPage === 'Profile'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
                title="View Profile"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                  {currentUser.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{currentUser.name}</span>
              </button>

              <button
                onClick={onLogout}
                title="Logout"
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500">Please sign in</div>
          )}
        </div>
      </div>
    </header>
  );
};

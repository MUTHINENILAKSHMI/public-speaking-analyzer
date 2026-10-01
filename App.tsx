/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PageName, User } from './types';
import { DatabaseService } from './services/db';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { NewSessionView } from './components/NewSessionView';
import { SessionsView } from './components/SessionsView';
import { CompareView } from './components/CompareView';
import { WeakAreasView } from './components/WeakAreasView';
import { AiFeedbackView } from './components/AiFeedbackView';
import { ProfileView } from './components/ProfileView';
import { ProjectCodeModal } from './components/ProjectCodeModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => DatabaseService.getCurrentUser());
  const [currentPage, setCurrentPage] = useState<PageName>('Dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentPage('Dashboard');
    setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    DatabaseService.logout();
    setCurrentUser(null);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Left-Side Vertical Sidebar (Fixed/Sticky on desktop, drawer on mobile) */}
      {currentUser && (
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page);
            setMobileSidebarOpen(false);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Right-Side Main Layout: Automatically shifted right by md:pl-64 when sidebar is present */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-150 ${currentUser ? 'md:pl-64' : ''}`}>
        {/* Top Companion Header (old horizontal nav items moved to left sidebar) */}
        <Navbar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          currentUser={currentUser}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setMobileSidebarOpen((prev) => !prev)}
        />

        {/* Main Content Area */}
        <main className="flex-1">
          {!currentUser ? (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          ) : (
            <>
              {currentPage === 'Dashboard' && (
                <DashboardView user={currentUser} onNavigate={setCurrentPage} />
              )}
              {currentPage === 'New Practice Session' && (
                <NewSessionView user={currentUser} onNavigate={setCurrentPage} />
              )}
              {currentPage === 'My Sessions' && (
                <SessionsView user={currentUser} onNavigate={setCurrentPage} />
              )}
              {currentPage === 'Compare Sessions' && (
                <CompareView user={currentUser} onNavigate={setCurrentPage} />
              )}
              {currentPage === 'Identify Weak Areas' && (
                <WeakAreasView user={currentUser} onNavigate={setCurrentPage} />
              )}
              {currentPage === 'AI Speech Feedback' && (
                <AiFeedbackView />
              )}
              {currentPage === 'Profile' && (
                <ProfileView user={currentUser} onLogout={handleLogout} onNavigate={setCurrentPage} />
              )}
              {currentPage === ('Project Code & SQL' as PageName) && (
                <ProjectCodeModal user={currentUser} />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Public Speaking Analyzer</span>
              <span>&bull;</span>
              <span>Student Final-Year / Capstone Project</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Python</span>
              <span>Streamlit</span>
              <span>MySQL</span>
              <span>Pandas</span>
              <span>Plotly</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

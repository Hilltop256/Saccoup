import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { IMAGES } from '@/lib/constants';
import LandingPage from './saccoUp/LandingPage';
import LoginModal from './saccoUp/LoginModal';
import Sidebar, { type DashboardPage } from './saccoUp/Sidebar';
import DashboardOverview from './saccoUp/DashboardOverview';
import MembersPage from './saccoUp/MembersPage';
import ContributionsPage from './saccoUp/ContributionsPage';
import LoansPage from './saccoUp/LoansPage';
import ReportsPage from './saccoUp/ReportsPage';
import GroupsPage from './saccoUp/GroupsPage';
import ChatPage from './saccoUp/ChatPage';
import AnnouncementsPage from './saccoUp/AnnouncementsPage';
import SettingsPage from './saccoUp/SettingsPage';

type AppView = 'loading' | 'landing' | 'dashboard';

const AppLayout: React.FC = () => {
  const { user, isAuthLoading, selectedGroup, logout } = useAppContext();

  const [appView, setAppView] = useState<AppView>('loading');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [currentPage, setCurrentPage] = useState<DashboardPage>('overview');
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);

  // Resolve app view once auth loading completes
  useEffect(() => {
    if (!isAuthLoading) {
      setAppView(user ? 'dashboard' : 'landing');
    }
  }, [isAuthLoading, user]);

  const handleGetStarted = () => {
    setLoginMode('register');
    setShowLoginModal(true);
  };

  const handleLogin = () => {
    setLoginMode('login');
    setShowLoginModal(true);
  };

  const handleAuthenticated = () => {
    setShowLoginModal(false);
    setAppView('dashboard');
  };

  const handleLogout = () => {
    logout();
    setAppView('landing');
    setCurrentPage('overview');
  };

  const getPageTitle = (): string => {
    switch (currentPage) {
      case 'overview': return 'Dashboard';
      case 'members': return 'Members';
      case 'contributions': return 'Contributions';
      case 'loans': return 'Loans';
      case 'reports': return 'Reports';
      case 'groups': return 'My Groups';
      case 'chat': return 'Group Chat';
      case 'announcements': return 'Announcements';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <DashboardOverview onNavigate={setCurrentPage} />;
      case 'members': return <MembersPage />;
      case 'contributions': return <ContributionsPage />;
      case 'loans': return <LoansPage />;
      case 'reports': return <ReportsPage />;
      case 'groups': return <GroupsPage />;
      case 'chat': return <ChatPage />;
      case 'announcements': return <AnnouncementsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardOverview onNavigate={setCurrentPage} />;
    }
  };

  // Auth loading splash
  if (appView === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066CC]/5 via-white to-[#00CC99]/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#00CC99] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-lg font-bold text-gray-900">Sacco<span className="text-[#0066CC]">Up</span></p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <div className="w-2 h-2 bg-[#0066CC] rounded-full animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 bg-[#0066CC] rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-[#0066CC] rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  // Landing Page View
  if (appView === 'landing') {
    return (
      <>
        <LandingPage onGetStarted={handleGetStarted} onLogin={handleLogin} />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleAuthenticated}
          mode={loginMode}
        />
      </>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={sidebarIsOpen}
        onClose={() => setSidebarIsOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="lg:ml-72 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarIsOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{getPageTitle()}</h1>
                <p className="text-xs text-gray-500 hidden sm:block">{selectedGroup?.name || 'No group selected'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Quick Pay button */}
              <button
                onClick={() => setCurrentPage('contributions')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Quick Pay
              </button>

              {/* User Avatar + Name */}
              <button
                onClick={() => setCurrentPage('settings')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="My settings"
              >
                <div className="relative">
                  <img
                    src={user?.photo_url || IMAGES.avatars[0]}
                    alt={user?.full_name || 'User'}
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }}
                  />
                  {user?.kyc_verified && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#00CC99] rounded-full border-2 border-white" title="KYC Verified" />
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-700 leading-tight">{user?.full_name?.split(' ')[0] || 'User'}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{selectedGroup?.user_role || 'member'}</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {renderPage()}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-100 px-4 sm:px-6 lg:px-8 py-4 mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <p>© 2026 SaccoUp by Trust Fund Uganda. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-600 transition-colors">Help Center</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;

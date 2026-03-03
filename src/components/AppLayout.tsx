import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useIsMobile } from '@/hooks/use-mobile';
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

type AppView = 'landing' | 'dashboard';

const AppLayout: React.FC = () => {
  const { sidebarOpen, toggleSidebar, user, selectedGroup, logout } = useAppContext();
  const isMobile = useIsMobile();

  const [appView, setAppView] = useState<AppView>('landing');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [currentPage, setCurrentPage] = useState<DashboardPage>('overview');
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);

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
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:block relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg w-64 focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* Quick Actions */}
              <button
                onClick={() => setCurrentPage('contributions')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Quick Pay
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-2">
                <img
                  src={user?.photo_url || IMAGES.avatars[0]}
                  alt={user?.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-100"
                  onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }}
                />
                <span className="hidden lg:block text-sm font-medium text-gray-700">{user?.full_name?.split(' ')[0] || 'User'}</span>
              </div>
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

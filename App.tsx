
import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { AppProvider } from './context/AppContext';
import { Dashboard } from './pages/Dashboard';
import { Goals } from './pages/Goals';
import { Journal } from './pages/Journal';
import { Insights } from './pages/Insights';
import { Profile } from './pages/Profile';
import { Navigation } from './components/Navigation';
import { SecurityLock } from './components/SecurityLock';
import NotificationSystem from './components/NotificationSystem';

const AppContent: React.FC = () => {
  const { isLocked, circadian, theme } = useApp();
  const [view, setView] = useState('dashboard');

  // Synchronize theme state with document class for Tailwind dark mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (isLocked) {
      return <SecurityLock />;
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard setView={setView} />;
      case 'goals':
        return <Goals setView={setView} />;
      case 'journal':
        return <Journal />;
      case 'insights':
        return <Insights setView={setView} />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard setView={setView} />;
    }
  };

  return (
    <div className="h-screen h-[100dvh] flex flex-col font-sans text-slate-800 dark:text-slate-100 max-w-lg mx-auto bg-slate-50 dark:bg-slate-950 shadow-2xl overflow-hidden relative">
      <NotificationSystem />
      
      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pt-safe-content px-6 pb-32">
        {renderView()}
      </main>

      {/* Persistent Navigation */}
      <Navigation currentView={view} setView={setView} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

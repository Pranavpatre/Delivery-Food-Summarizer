import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from './api/client';
import type { User } from './types';
import LoginPage from './components/LoginPage';
import SummaryPage from './components/SummaryPage';
import CalendarPage from './components/CalendarPage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

type Page = 'summary' | 'calendar';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('summary');

  useEffect(() => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('token');

    if (authToken) {
      // Save token from OAuth callback
      localStorage.setItem('auth_token', authToken);
      setToken(authToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Load user data if we have a token
    const loadUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('auth_token');
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setToken(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const renderPage = () => {
    if (!user) {
      return <LoginPage />;
    }

    switch (currentPage) {
      case 'summary':
        return <SummaryPage onGoToCalendar={() => setCurrentPage('calendar')} />;
      case 'calendar':
        return <CalendarPage onGoToSummary={() => setCurrentPage('summary')} />;
      default:
        return <SummaryPage onGoToCalendar={() => setCurrentPage('calendar')} />;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {renderPage()}
    </AuthContext.Provider>
  );
}

export default App;

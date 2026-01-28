import { Toaster } from '@/app/components/ui/sonner';
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { LoginPage } from '@/app/components/LoginPage';
import { AdminLoginPage } from '@/app/components/AdminLoginPage';
import { ForgotPassword } from '@/app/components/ForgotPassword';
import { UserDashboard } from '@/app/components/UserDashboard';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { useEffect, useState } from 'react';

type Page = 'user-login' | 'admin-login' | 'forgot-password';

function AppContent() {
  const { isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('user-login');

  const pageFromPath = (pathname: string): Page => {
    if (pathname.startsWith('/admin')) return 'admin-login';
    if (pathname.startsWith('/forgot')) return 'forgot-password';
    return 'user-login';
  };

  const pathFromPage = (page: Page): string => {
    switch (page) {
      case 'admin-login':
        return '/admin';
      case 'forgot-password':
        return '/forgot';
      default:
        return '/';
    }
  };

  const navigate = (page: Page) => {
    setCurrentPage(page);
    const nextPath = pathFromPage(page);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  useEffect(() => {
    const applyRoute = () => setCurrentPage(pageFromPath(window.location.pathname));
    applyRoute();
    window.addEventListener('popstate', applyRoute);
    return () => window.removeEventListener('popstate', applyRoute);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // 已登录状态
  if (isAuthenticated) {
    if (isAdmin) {
      return <AdminDashboard onLogout={logout} />;
    }
    return <UserDashboard onLogout={logout} />;
  }

  // 未登录状态 - 显示登录页面
  return (
    <>
      {currentPage === 'user-login' && (
        <LoginPage
          onNavigateToForgotPassword={() => navigate('forgot-password')}
        />
      )}

      {currentPage === 'admin-login' && (
        <AdminLoginPage
          onNavigateToUser={() => navigate('user-login')}
        />
      )}

      {currentPage === 'forgot-password' && (
        <ForgotPassword
          onBack={() => navigate('user-login')}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}

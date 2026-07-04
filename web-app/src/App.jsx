import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import ProtectedRoute from './components/ProtectedRoute';
import Toast from './components/Toast';
import { LogOut, Box } from 'lucide-react';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="w-full bg-slate-800/80 backdrop-blur-md p-4 shadow-lg border-b border-slate-700/50 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
            <Box className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            Smart Locker System
          </h1>
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">
              Xin chào, <span className="text-indigo-400 font-medium">{user.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all text-sm border border-slate-600/50 hover:border-slate-500/50"
            >
              <LogOut className="w-3.5 h-3.5" /> Thoát
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
        <Header />
        <Toast />
        <main className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex-grow">
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute><Checkout /></ProtectedRoute>
            } />
          </Routes>
        </main>
        <footer className="text-center py-4 text-slate-600 text-xs border-t border-slate-800/50">
          © 2026 Smart Locker System — Đại học Phenikaa
        </footer>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

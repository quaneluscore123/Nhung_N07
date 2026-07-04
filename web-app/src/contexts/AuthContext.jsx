import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Khôi phục session từ localStorage + xác thực token với server
    const validateSession = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedToken && savedUser) {
        try {
          // Gọi API kiểm tra token còn hợp lệ không
          const res = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          setToken(savedToken);
          setUser(res.data.user);
        } catch (err) {
          // Token hết hạn hoặc server đã restart → xoá session cũ
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          console.log('[Auth] Session cũ không hợp lệ, yêu cầu đăng nhập lại');
        }
      }
      setLoading(false);
    };
    validateSession();
  }, []);

  // Cấu hình axios header khi có token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { username, password });
    const { user: userData, token: jwt } = res.data;
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', jwt);
    return res.data;
  };

  const register = async (username, phone, password) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, { username, phone, password });
    return res.data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

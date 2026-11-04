import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await axiosClient.get('/auth/me');
        setUser(data.user);
      } catch (error) {
        setUser(null); 
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const { data } = await axiosClient.post('/auth/login', { email, password });
    setUser(data.user);
  };

  const logout = async () => {
    await axiosClient.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
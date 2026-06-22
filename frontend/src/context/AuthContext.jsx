import { createContext, useContext, useState } from 'react';

const TOKEN_KEY    = 'admin_token';
const USERNAME_KEY = 'admin_username';
const ADMIN_API    = 'http://localhost:8000/api/admin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!sessionStorage.getItem(TOKEN_KEY)
  );

  async function login(username, password) {
    try {
      const res = await fetch(`${ADMIN_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return false;
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(USERNAME_KEY, username);
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${ADMIN_API}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    setIsAuthenticated(false);
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function getCurrentUsername() {
    return sessionStorage.getItem(USERNAME_KEY) || '';
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, getToken, getCurrentUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

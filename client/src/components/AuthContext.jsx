import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('poc_role') || 'admin');
  const [userId, setUserId] = useState(() => localStorage.getItem('poc_user_id') || 'user1');

  const updateRole = (newRole) => {
    setRole(newRole);
    localStorage.setItem('poc_role', newRole);
  };

  const updateUserId = (newId) => {
    setUserId(newId);
    localStorage.setItem('poc_user_id', newId);
  };

  return (
    <AuthContext.Provider value={{ role, userId, setRole: updateRole, setUserId: updateUserId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

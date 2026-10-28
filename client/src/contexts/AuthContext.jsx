import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loginWithEmail,
  loginWithGoogle,
  logoutUser,
  registerWithEmail,
} from '../services/firebase.js';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [mongoUser, setMongoUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function syncBackendUser(firebaseUser) {
    if (!firebaseUser) {
      setMongoUser(null);
      return;
    }
    try {
      const data = await api.syncUser({
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        profileImage: firebaseUser.photoURL
          ? { secureUrl: firebaseUser.photoURL }
          : undefined,
      });
      setMongoUser(data);
    } catch (err) {
      console.error('Failed to sync user with MongoDB backend:', err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncBackendUser(user);
      } else {
        setMongoUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signInGoogle() {
    const user = await loginWithGoogle();
    await syncBackendUser(user);
    return user;
  }

  async function signInEmail(email, password) {
    const user = await loginWithEmail(email, password);
    await syncBackendUser(user);
    return user;
  }

  async function signUpEmail(email, password, displayName) {
    const user = await registerWithEmail(email, password, displayName);
    await syncBackendUser(user);
    return user;
  }

  async function logout() {
    await logoutUser();
    setCurrentUser(null);
    setMongoUser(null);
  }

  async function refreshUser() {
    if (auth.currentUser) {
      const data = await api.getMe();
      setMongoUser(data);
    }
  }

  const value = {
    currentUser,
    mongoUser,
    loading,
    signInGoogle,
    signInEmail,
    signUpEmail,
    logout,
    refreshUser,
    isAuthenticated: Boolean(currentUser && mongoUser),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

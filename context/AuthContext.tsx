import React, { createContext, useContext, useState, useEffect } from 'react';
import { secureStorage, SECURE_KEYS } from '../services/secureStorage';
import { UserRole, UserSession } from '../types';
import { loginRequest, logoutRequest, registerRequest, validateToken } from '../services/authApi';
import { ApiError, getApiErrorMessage } from '../services/apiRequest';

interface AuthResponse {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  currentUser: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  login: (identifier: string, password: string, role: UserRole) => Promise<AuthResponse>;
  register: (name: string, identifier: string, password: string, role: UserRole) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inisialisasi: Periksa apakah sesi sensitif tersimpan di Secure Storage
  useEffect(() => {
    bootstrapAuth();
  }, []);

  const bootstrapAuth = async () => {
    try {
      // Kredensial akun mock lama tidak lagi dibutuhkan setelah autentikasi dipindah ke API.
      await secureStorage.deleteSensitiveItem(SECURE_KEYS.USER_CREDENTIALS);
      // Pulihkan token server dan sesi pengguna dari penyimpanan aman.
      const token = await secureStorage.getSensitiveItem<string>(SECURE_KEYS.AUTH_TOKEN);
      const session = await secureStorage.getSensitiveItem<UserSession>(SECURE_KEYS.USER_SESSION);

      if (token && session) {
        if (token.startsWith('sec_tok_')) {
          await secureStorage.clearSession();
          setCurrentUser(null);
          setIsAuthenticated(false);
        } else {
          try {
            const validatedUser = await validateToken(token);
            if (!validatedUser) {
              await secureStorage.clearSession();
              setCurrentUser(null);
              setIsAuthenticated(false);
            } else {
              const restoredSession = { ...validatedUser, loginAt: session.loginAt };
              await secureStorage.setSensitiveItem(SECURE_KEYS.USER_SESSION, restoredSession);
              setCurrentUser(restoredSession);
              setIsAuthenticated(true);
            }
          } catch (error) {
            // Pertahankan sesi tersimpan saat offline; protected API tetap memvalidasi token.
            if (error instanceof ApiError && ['offline', 'network', 'timeout'].includes(error.kind)) {
              setCurrentUser(session);
              setIsAuthenticated(true);
            } else {
              throw error;
            }
          }
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.warn('Gagal memuat sesi autentikasi:', e);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Task 01 & Task 03: Alur Login & Validasi Keamanan
   */
  const login = async (identifier: string, password: string, role: UserRole): Promise<AuthResponse> => {
    setErrorMessage(null);

    // 1. Skenario Empty Input: Validasi tidak boleh kosong
    if (!identifier || !identifier.trim() || !password || !password.trim()) {
      const err = 'Email/Username dan Password wajib diisi.';
      setErrorMessage(err);
      return { success: false, error: err };
    }

    try {
      const result = await loginRequest(identifier.trim(), password, role);
      await secureStorage.setSensitiveItem(SECURE_KEYS.AUTH_TOKEN, result.token);
      await secureStorage.setSensitiveItem(SECURE_KEYS.USER_SESSION, result.user);
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      setErrorMessage(null);
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError && error.status === 401
        ? error.message
        : getApiErrorMessage(error, 'login');
      setErrorMessage(message);
      return { success: false, error: message };
    }
  };

  /**
   * Task 01 & Task 03: Alur Register Akun Baru
   */
  const register = async (name: string, identifier: string, password: string, role: UserRole): Promise<AuthResponse> => {
    setErrorMessage(null);

    // Validasi input kosong
    if (!name || !name.trim() || !identifier || !identifier.trim() || !password || !password.trim()) {
      const err = 'Semua field formulir pendaftaran wajib diisi.';
      setErrorMessage(err);
      return { success: false, error: err };
    }

    if (password.trim().length < 6) {
      const err = 'Kata sandi minimal harus terdiri dari 6 karakter.';
      setErrorMessage(err);
      return { success: false, error: err };
    }

    try {
      const result = await registerRequest(name.trim(), identifier.trim(), password, role);
      await secureStorage.setSensitiveItem(SECURE_KEYS.AUTH_TOKEN, result.token);
      await secureStorage.setSensitiveItem(SECURE_KEYS.USER_SESSION, result.user);
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      setErrorMessage(null);
      return { success: true };
    } catch (error) {
      const message = getApiErrorMessage(error, 'pendaftaran');
      setErrorMessage(message);
      return { success: false, error: message };
    }
  };

  /**
   * Task 03: Skenario Logout
   * Menghapus sesi dan data sensitif secara eksplisit dari Secure Storage.
   */
  const logout = async (): Promise<void> => {
    try {
      const token = await secureStorage.getSensitiveItem<string>(SECURE_KEYS.AUTH_TOKEN);
      if (token) await logoutRequest(token);
      await secureStorage.clearSession();
    } catch (e) {
      console.warn('Error clearing secure session:', e);
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setErrorMessage(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        errorMessage,
        setErrorMessage,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

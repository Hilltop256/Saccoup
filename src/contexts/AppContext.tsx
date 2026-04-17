import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthResult {
  success: boolean;
  phone?: string;
  demoOtp?: string;
  error?: string;
}

interface User {
  id: string;
  phone: string;
  full_name?: string;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (phone: string, pin: string) => Promise<AuthResult>;
  register: (...args: any[]) => Promise<AuthResult>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (phone: string) => Promise<AuthResult>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);

  // ✅ Restore user on refresh
  useEffect(() => {
    const storedUser = localStorage.getItem('demoUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ✅ Persist user
  useEffect(() => {
    if (user) {
      localStorage.setItem('demoUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('demoUser');
    }
  }, [user]);

  const login = async (phone: string, pin: string): Promise<AuthResult> => {
    try {
      console.log('LOGIN:', phone, pin);

      return {
        success: true,
        phone,
        demoOtp: '123456', // demo OTP
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const register = async (...args: any[]): Promise<AuthResult> => {
    try {
      console.log('REGISTER:', args);

      return {
        success: true,
        phone: args[0],
        demoOtp: '123456',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 🔥 FIXED: This is what logs the user into the app
  const verifyOtp = async (phone: string, otp: string) => {
    if (otp === '123456') {
      const mockUser: User = {
        id: 'demo-user-id',
        phone,
        full_name: 'Demo User',
      };

      setUser(mockUser); // ✅ THIS FIXES YOUR WHITE SCREEN

      return { success: true };
    }

    return { success: false, error: 'Invalid OTP' };
  };

  const resendOtp = async (phone: string): Promise<AuthResult> => {
    return {
      success: true,
      demoOtp: '123456',
    };
  };

  return (
    <AppContext.Provider value={{ user, setUser, login, register, verifyOtp, resendOtp }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

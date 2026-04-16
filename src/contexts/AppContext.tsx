import React, { createContext, useContext, useState } from 'react';

interface AuthResult {
  success: boolean;
  phone?: string;
  demoOtp?: string;
  error?: string;
}

interface AppContextType {
  login: (phone: string, pin: string) => Promise<AuthResult>;
  register: (...args: any[]) => Promise<AuthResult>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (phone: string) => Promise<AuthResult>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const login = async (phone: string, pin: string): Promise<AuthResult> => {
    try {
      // 🔥 your real login logic here (Supabase)
      console.log('LOGIN:', phone, pin);

      return {
        success: true,
        phone,
        demoOtp: '123456', // test OTP
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

  const verifyOtp = async (phone: string, otp: string) => {
    if (otp === '123456') {
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
    <AppContext.Provider value={{ login, register, verifyOtp, resendOtp }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

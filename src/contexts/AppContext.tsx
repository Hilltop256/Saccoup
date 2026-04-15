import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  member_id: string;
  phone: string;
  full_name: string;
  email?: string | null;
  national_id?: string | null;
  photo_url?: string | null;
  kyc_verified: boolean;
  created_at?: string;
}

interface AppContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;

  register: (
    phone: string,
    pin: string,
    fullName: string,
    photoDataUrl: string,
    nationalId: string,
    email: string,
    dateOfBirth: string
  ) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;

  login: (phone: string, pin: string) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;
  verifyOtp: (phone: string, otpCode: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (phone: string) => Promise<{ success: boolean; demoOtp?: string }>;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useAppContext = () => useContext(AppContext);

const SESSION_KEY = 'saccoup_session';

function normPhone(ph: string): string {
  let c = ph.replace(/[\s\-()]/g, '');
  if (c.startsWith('0')) c = '+256' + c.substring(1);
  else if (c.startsWith('256') && !c.startsWith('+')) c = '+' + c;
  else if (!c.startsWith('+')) c = '+256' + c;
  return c;
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'saccoup2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const restore = async () => {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return setIsAuthLoading(false);

      try {
        const session = JSON.parse(stored);

        const { data: acc } = await supabase
          .from('user_accounts')
          .select('id, member_id, phone')
          .eq('id', session.user_account_id)
          .maybeSingle();

        if (!acc) return setIsAuthLoading(false);

        const { data: mem } = await supabase
          .from('members')
          .select('*')
          .eq('id', acc.member_id)
          .single();

        if (!mem) return setIsAuthLoading(false);

        setUser({
          id: acc.id,
          member_id: acc.member_id,
          phone: acc.phone,
          full_name: mem.full_name,
          email: mem.email,
          national_id: mem.national_id,
          photo_url: mem.photo_url,
          kyc_verified: mem.kyc_verified,
        });
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }

      setIsAuthLoading(false);
    };

    restore();
  }, []);

  // ✅ REGISTER (NO INVITE CODE)
  const register = async (
    phone: string,
    pin: string,
    fullName: string,
    photoDataUrl: string,
    nationalId: string,
    email: string,
    dateOfBirth: string
  ) => {
    const normalizedPhone = normPhone(phone);

    if (pin.length < 4) {
      return { success: false, error: 'PIN must be at least 4 digits' };
    }

    // ✅ Prevent duplicates
    const { data: existing } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Phone already registered' };
    }

    // Convert DOB
    let dob: string | null = null;
    if (dateOfBirth) {
      const parts = dateOfBirth.split('/');
      if (parts.length === 3) {
        dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const { data: member, error: memErr } = await supabase
      .from('members')
      .insert({
        full_name: fullName,
        phone: normalizedPhone,
        email,
        national_id: nationalId,
        date_of_birth: dob,
        photo_url: photoDataUrl,
        kyc_verified: false,
        is_active: true,
      })
      .select('id')
      .single();

    if (memErr || !member) {
      return { success: false, error: 'Failed to create member' };
    }

    const pinHash = await hashPin(pin);

    const { error: accErr } = await supabase.from('user_accounts').insert({
      member_id: member.id,
      phone: normalizedPhone,
      pin_hash: pinHash,
    });

    if (accErr) {
      await supabase.from('members').delete().eq('id', member.id);
      return { success: false, error: 'Failed to create account' };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: otp,
      purpose: 'register',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });

    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  // LOGIN
  const login = async (phone: string, pin: string) => {
    const normalizedPhone = normPhone(phone);
    const pinHash = await hashPin(pin);

    const { data: acc } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (!acc) return { success: false, error: 'Account not found' };
    if (acc.pin_hash !== pinHash) return { success: false, error: 'Invalid PIN' };

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: otp,
      purpose: 'login',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });

    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  // VERIFY OTP (FIXED)
  const verifyOtp = async (phone: string, otpCode: string) => {
    const normalizedPhone = normPhone(phone);

    const { data: otpRec } = await supabase
      .from('otp_codes')
      .select('id, code, expires_at')
      .eq('phone', normalizedPhone)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRec) return { success: false, error: 'No OTP found' };

    if (new Date(otpRec.expires_at) < new Date()) {
      return { success: false, error: 'OTP expired' };
    }

    if (otpRec.code !== otpCode) {
      return { success: false, error: 'Invalid OTP' };
    }

    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id);

    const { data: acc } = await supabase
      .from('user_accounts')
      .select('id, member_id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (!acc) return { success: false, error: 'Account not found' };

    const { data: mem } = await supabase
      .from('members')
      .select('*')
      .eq('id', acc.member_id)
      .single();

    const authUser: AuthUser = {
      id: acc.id,
      member_id: acc.member_id,
      phone: normalizedPhone,
      full_name: mem.full_name,
      email: mem.email,
      national_id: mem.national_id,
      photo_url: mem.photo_url,
      kyc_verified: mem.kyc_verified,
    };

    setUser(authUser);

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        user_account_id: acc.id,
        member_id: acc.member_id,
      })
    );

    return { success: true };
  };

  const resendOtp = async (phone: string) => {
    const normalizedPhone = normPhone(phone);

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: otp,
      purpose: 'login',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });

    return { success: true, demoOtp: otp };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthLoading,
        register,
        login,
        verifyOtp,
        resendOtp,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

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

export interface GroupMembership {
  group_id: string;
  role: string;
  group: {
    id: string;
    name: string;
    group_type: string;
    contribution_amount: number;
    contribution_schedule: string;
    invite_code: string;
  };
}

export interface GroupData {
  id: string;
  name: string;
  group_type: string;
  description?: string;
  contribution_amount: number;
  contribution_schedule: string;
  invite_code: string;
  interest_rate?: number;
  late_fee?: number;
  grace_period_days?: number;
  members_count: number;
  total_savings: number;
  user_role?: string;
  is_active?: boolean;
  created_at?: string;
}

interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  user: AuthUser | null;
  memberships: GroupMembership[];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  groups: GroupData[];
  selectedGroupId: string | null;
  selectedGroup: GroupData | null;
  setSelectedGroupId: (id: string) => void;
  refreshGroups: () => Promise<void>;
  isChairman: boolean;
  isTreasurer: boolean;
  isAdmin: boolean;
  isElevated: boolean;
  register: any;
  login: any;
  verifyOtp: any;
  resendOtp: any;
  logout: () => void;
  clearAuthError: () => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useAppContext = () => useContext(AppContext);

const SESSION_KEY = 'saccoup_session';

export function normPhone(ph: string): string {
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const clearAuthError = () => setAuthError(null);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0] || null;

  const role = (selectedGroup?.user_role || '').toLowerCase();
  const isChairman = role === 'chairperson';
  const isTreasurer = role === 'treasurer';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isElevated = isChairman || isTreasurer || isAdmin;

  const setSelectedGroupId = (id: string) => {
    setSelectedGroupIdState(id);
    localStorage.setItem('saccoup_selected_group', id);
  };

  const loadMemberships = useCallback(async (memberId: string) => {
    const { data } = await supabase
      .from('group_memberships')
      .select('group_id, role, groups(id, name, group_type, contribution_amount, contribution_schedule, invite_code)')
      .eq('member_id', memberId)
      .eq('is_active', true);

    if (data) {
      setMemberships(data.map((m: any) => ({
        group_id: m.group_id,
        role: m.role,
        group: m.groups
      })));
    }
  }, []);

  // ================= REGISTER (FIXED) =================
  const register = async (
    phone: string,
    pin: string,
    fullName: string,
    inviteCode: string,
    photoDataUrl: string,
    nationalId: string,
    email: string,
    dateOfBirth: string
  ) => {
    setAuthError(null);

    const normalizedPhone = normPhone(phone);

    if (pin.length < 4) {
      return { success: false, error: 'PIN must be at least 4 digits' };
    }

    const { data: existing } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Phone already registered' };
    }

    const { data: member, error: memErr } = await supabase
      .from('members')
      .insert({
        full_name: fullName,
        phone: normalizedPhone,
        email: email || null,
        national_id: nationalId || null,
        kyc_verified: false,
        is_active: true,
        photo_url: photoDataUrl || null,
      })
      .select('id')
      .single();

    if (memErr || !member) {
      return {
        success: false,
        error: memErr?.message || 'Failed to create member'
      };
    }

    const pinHash = await hashPin(pin);

    const { error: accErr } = await supabase
      .from('user_accounts')
      .insert({
        member_id: member.id,
        phone: normalizedPhone,
        pin_hash: pinHash
      });

    if (accErr) {
      await supabase.from('members').delete().eq('id', member.id);

      return {
        success: false,
        error: accErr.message || 'Failed to create account'
      };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: otp,
      purpose: 'register',
      expires_at: new Date(Date.now() + 600000).toISOString()
    });

    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  // ================= LOGIN =================
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
      expires_at: new Date(Date.now() + 600000).toISOString()
    });

    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  const verifyOtp = async (phone: string, otpCode: string) => {
    const normalizedPhone = normPhone(phone);

    const { data: otpRec } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('is_used', false)
      .maybeSingle();

    if (!otpRec) return { success: false, error: 'No OTP' };
    if (otpRec.code !== otpCode) return { success: false, error: 'Invalid OTP' };

    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id);

    return { success: true };
  };

  const resendOtp = async (phone: string) => {
    const normalizedPhone = normPhone(phone);

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: otp,
      purpose: 'login',
      expires_at: new Date(Date.now() + 600000).toISOString()
    });

    return { success: true, demoOtp: otp };
  };

  const logout = () => {
    setUser(null);
    setMemberships([]);
    setGroups([]);
    setSelectedGroupIdState(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar,
        user,
        memberships,
        isAuthenticated: !!user,
        isAuthLoading,
        authError,
        groups,
        selectedGroupId,
        selectedGroup,
        setSelectedGroupId,
        refreshGroups: async () => {},
        isChairman,
        isTreasurer,
        isAdmin,
        isElevated,
        register,
        login,
        verifyOtp,
        resendOtp,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

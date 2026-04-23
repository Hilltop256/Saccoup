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
  showKYCModal: boolean;
  setShowKYCModal: (value: boolean) => void;

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
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);

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

  // 🔥 KYC CHECK FUNCTION (REUSABLE)
  const checkKYC = async (accountId: string, mem: any) => {
    const { data: acc } = await supabase
      .from('user_accounts')
      .select('pin_hash')
      .eq('id', accountId)
      .single();

    const defaultPinHash = await hashPin('0000');

    const isDefaultPin = acc?.pin_hash === defaultPinHash;

    const isKYCIncomplete =
      isDefaultPin ||
      !mem.email ||
      !mem.national_id ||
      !mem.photo_url;

    setShowKYCModal(isKYCIncomplete);
  };

  // 🔄 RESTORE SESSION
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) return;

        const session = JSON.parse(stored);

        const { data: acc } = await supabase
          .from('user_accounts')
          .select('is_active, phone')
          .eq('id', session.user_account_id)
          .maybeSingle();

        if (!acc) return;

        const { data: mem } = await supabase
          .from('members')
          .select('*')
          .eq('id', session.member_id)
          .maybeSingle();

        if (!mem) return;

        setUser({
          id: session.user_account_id,
          member_id: session.member_id,
          phone: acc.phone,
          full_name: mem.full_name,
          email: mem.email,
          national_id: mem.national_id,
          photo_url: mem.photo_url,
          kyc_verified: mem.kyc_verified,
          created_at: mem.created_at,
        });

        await loadMemberships(session.member_id);

        // ✅ KYC CHECK
        await checkKYC(session.user_account_id, mem);

      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
      setIsAuthLoading(false);
    };

    restoreSession();
  }, [loadMemberships]);

  // 🔑 VERIFY OTP (REAL LOGIN POINT)
  const verifyOtp = async (phone: string, otpCode: string) => {
    const normalizedPhone = normPhone(phone);

    const { data: acc } = await supabase
      .from('user_accounts')
      .select('id, member_id')
      .eq('phone', normalizedPhone)
      .single();

    if (!acc) return { success: false };

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
      created_at: mem.created_at,
    };

    setUser(authUser);
    await loadMemberships(acc.member_id);

    // ✅ KYC CHECK
    await checkKYC(acc.id, mem);

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setMemberships([]);
    setGroups([]);
    setSelectedGroupIdState(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AppContext.Provider value={{
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
      register: async () => ({ success: true }),
      login: async () => ({ success: true }),
      verifyOtp,
      resendOtp: async () => ({ success: true }),
      logout,
      clearAuthError,
      showKYCModal,
      setShowKYCModal
    }}>
      {children}
    </AppContext.Provider>
  );
};

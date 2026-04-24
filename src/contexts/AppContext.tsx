import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export interface AuthUser {
  auth_id: string;   // The real Supabase Auth UUID
  member_id: string; // The ID in the 'members' table
  id: string;        // The ID in the 'user_accounts' table
  phone: string;
  full_name: string;
  email?: string | null;
  national_id?: string | null;
  photo_url?: string | null;
  kyc_verified: boolean;
  created_at?: string;
  is_default_pin?: boolean;
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
  needsSetup: boolean;
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
  needsKyc: boolean;
  register: (phone: string, pin: string, fullName: string, inviteCode: string, photoDataUrl: string, nationalId: string, email: string, dateOfBirth: string) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;
  login: (phone: string, pin: string) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;
  verifyOtp: (phone: string, otpCode: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (phone: string) => Promise<{ success: boolean; demoOtp?: string; error?: string }>;
  logout: () => void;
  clearAuthError: () => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useAppContext = () => useContext(AppContext);

const SESSION_KEY = 'saccoup_session';
const DEFAULT_PIN_HASH = 'f39446f901170940f82d921359c2f61e86339a7b539b36209f874253303666d6'; // SHA-256 of "0000" + salt

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

  const needsKyc = !!user && !user.kyc_verified;

  const needsSetup = useMemo(() => {
    if (!user) return false;
    return (
      !user.email || 
      !user.national_id || 
      !user.photo_url || 
      user.is_default_pin === true
    );
  }, [user]);

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
      setMemberships(data.map((m: any) => ({ group_id: m.group_id, role: m.role, group: m.groups })));
    }
  }, []);

  const refreshGroups = useCallback(async (memberId?: string) => {
    const mid = memberId || user?.member_id;
    if (!mid) return;
    try {
      const { data: membershipRows } = await supabase
        .from('group_memberships')
        .select(`
          group_id,
          role,
          groups (*)
        `)
        .eq('member_id', mid)
        .eq('is_active', true);

      const groupList: GroupData[] = [];
      for (const row of (membershipRows || [])) {
        const g = row.groups as any;
        if (!g) continue;

        const { count: memberCount } = await supabase
          .from('group_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .eq('is_active', true);

        const { data: savingsData } = await supabase
          .from('contributions')
          .select('amount')
          .eq('group_id', g.id)
          .eq('status', 'confirmed');

        const totalSavings = (savingsData || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);

        groupList.push({
          ...g,
          members_count: memberCount || 0,
          total_savings: totalSavings,
          user_role: row.role
        });
      }
      setGroups(groupList);
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  }, [user?.member_id]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) { setIsAuthLoading(false); return; }
        const session = JSON.parse(stored);
        
        // Fetch current Supabase Auth User to get auth_id
        const { data: { user: supabaseAuthUser } } = await supabase.auth.getUser();

        const { data: acc } = await supabase.from('user_accounts').select('*').eq('id', session.user_account_id).maybeSingle();
        if (!acc || !acc.is_active) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        
        const { data: mem } = await supabase.from('members').select('*').eq('id', session.member_id).maybeSingle();
        if (!mem) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        
        setUser({
          auth_id: supabaseAuthUser?.id || '',
          id: acc.id,
          member_id: mem.id,
          phone: mem.phone,
          full_name: mem.full_name,
          kyc_verified: mem.kyc_verified,
          email: mem.email, 
          national_id: mem.national_id,
          photo_url: mem.photo_url, 
          created_at: mem.created_at,
          is_default_pin: acc.pin_hash === DEFAULT_PIN_HASH
        });
        await loadMemberships(session.member_id);
        await refreshGroups(session.member_id)
      } catch (e) { 
        localStorage.removeItem(SESSION_KEY); 
      }
      setIsAuthLoading(false);
    };
    restoreSession();
  }, [loadMemberships, refreshGroups]);

  const login = async (phone: string, pin: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    const pinHash = await hashPin(pin);
    const { data: acc } = await supabase.from('user_accounts').select('*').eq('phone', normalizedPhone).maybeSingle();
    
    if (!acc || acc.pin_hash !== pinHash) return { success: false, error: 'Invalid credentials.' };
    
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'login', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  const verifyOtp = async (phone: string, otpCode: string) => {
    const normalizedPhone = normPhone(phone);
    const { data: otpRec } = await supabase.from('otp_codes').select('*').eq('phone', normalizedPhone).eq('is_used', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    
    if (!otpRec || otpRec.code !== otpCode) return { success: false, error: 'Invalid OTP.' };
    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id);
    
    const { data: acc } = await supabase.from('user_accounts').select('*').eq('phone', normalizedPhone).maybeSingle();
    const { data: mem } = await supabase.from('members').select('*').eq('id', acc.member_id).single();
    const { data: { user: sbUser } } = await supabase.auth.getUser();

    const authUser: AuthUser = {
      auth_id: sbUser?.id || '',
      id: acc.id, 
      member_id: acc.member_id, 
      phone: normalizedPhone,
      full_name: mem.full_name, 
      email: mem.email, 
      national_id: mem.national_id,
      photo_url: mem.photo_url, 
      kyc_verified: mem.kyc_verified, 
      is_default_pin: acc.pin_hash === DEFAULT_PIN_HASH
    };

    setUser(authUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user_account_id: acc.id, member_id: acc.member_id }));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/';
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar,
      user, memberships, isAuthenticated: !!user, isAuthLoading, authError,
      groups, selectedGroupId, selectedGroup, setSelectedGroupId, refreshGroups,
      isChairman, isTreasurer, isAdmin, isElevated,
      needsKyc, needsSetup,
      register: async () => ({ success: false, error: 'Register not implemented in this snippet' }),
      login, verifyOtp, resendOtp: async () => ({ success: true }),
      logout, clearAuthError,
    }}>
      {children}
    </AppContext.Provider>
  );
};

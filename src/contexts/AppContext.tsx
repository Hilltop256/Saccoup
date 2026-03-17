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
  // Auth
  user: AuthUser | null;
  memberships: GroupMembership[];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  // Group management
  groups: GroupData[];
  selectedGroupId: string | null;
  selectedGroup: GroupData | null;
  setSelectedGroupId: (id: string) => void;
  refreshGroups: () => Promise<void>;
  // Auth actions
  register: (phone: string, pin: string, fullName: string, inviteCode?: string, photoDataUrl?: string) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;
  login: (phone: string, pin: string) => Promise<{ success: boolean; phone?: string; demoOtp?: string; error?: string }>;
  verifyOtp: (phone: string, otpCode: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (phone: string) => Promise<{ success: boolean; demoOtp?: string; error?: string }>;
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

  const setSelectedGroupId = (id: string) => {
    setSelectedGroupIdState(id);
    localStorage.setItem('saccoup_selected_group', id);
  };

  // Load groups for the authenticated member from Supabase directly
  const refreshGroups = useCallback(async (memberId?: string) => {
    const mid = memberId || user?.member_id;
    if (!mid) return;
    try {
      // Fetch groups where this member has an active membership
      const { data: membershipRows, error: mErr } = await supabase
        .from('group_memberships')
        .select(`
          group_id,
          role,
          groups (
            id,
            name,
            group_type,
            description,
            contribution_amount,
            contribution_schedule,
            invite_code,
            interest_rate,
            late_fee,
            grace_period_days,
            is_active,
            created_at
          )
        `)
        .eq('member_id', mid)
        .eq('is_active', true);

      if (mErr) {
        console.error('Error fetching memberships:', mErr);
        return;
      }

      const groupList: GroupData[] = [];
      for (const row of (membershipRows || [])) {
        const g = row.groups as any;
        if (!g) continue;

        // Fetch member count
        const { count: memberCount } = await supabase
          .from('group_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .eq('is_active', true);

        // Fetch total confirmed savings
        const { data: savingsData } = await supabase
          .from('contributions')
          .select('amount')
          .eq('group_id', g.id)
          .eq('status', 'confirmed');

        const totalSavings = (savingsData || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);

        groupList.push({
          id: g.id,
          name: g.name,
          group_type: g.group_type,
          description: g.description,
          contribution_amount: g.contribution_amount || 0,
          contribution_schedule: g.contribution_schedule || 'monthly',
          invite_code: g.invite_code,
          interest_rate: g.interest_rate,
          late_fee: g.late_fee,
          grace_period_days: g.grace_period_days,
          members_count: memberCount || 0,
          total_savings: totalSavings,
          user_role: row.role,
          is_active: g.is_active,
          created_at: g.created_at,
        });
      }

      setGroups(groupList);

      // Restore previously selected group if still in list
      const savedGroupId = localStorage.getItem('saccoup_selected_group');
      if (savedGroupId && groupList.find(g => g.id === savedGroupId)) {
        setSelectedGroupIdState(savedGroupId);
      } else if (groupList.length > 0 && !selectedGroupId) {
        setSelectedGroupIdState(groupList[0].id);
      }
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  }, [user?.member_id, selectedGroupId]);

  // Load groups when user changes
  useEffect(() => {
    if (user?.member_id) {
      refreshGroups(user.member_id);
    }
  }, [user?.member_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load memberships for a member
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

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) { setIsAuthLoading(false); return; }
        const session = JSON.parse(stored);
        if (!session.user_account_id || !session.member_id) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        if (session.expires_at && new Date(session.expires_at) < new Date()) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        const { data: acc } = await supabase.from('user_accounts').select('is_active, phone').eq('id', session.user_account_id).maybeSingle();
        if (!acc || !acc.is_active) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        const { data: mem } = await supabase.from('members').select('*').eq('id', session.member_id).maybeSingle();
        if (!mem) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        setUser({
          id: session.user_account_id, member_id: session.member_id, phone: acc.phone,
          full_name: mem.full_name, email: mem.email, national_id: mem.national_id,
          photo_url: mem.photo_url, kyc_verified: mem.kyc_verified, created_at: mem.created_at,
        });
        await loadMemberships(session.member_id);
      } catch (e) { localStorage.removeItem(SESSION_KEY); }
      setIsAuthLoading(false);
    };
    restoreSession();
  }, [loadMemberships]);

  // Register
  const register = async (phone: string, pin: string, fullName: string, inviteCode?: string, photoDataUrl?: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    if (pin.length < 4) return { success: false, error: 'PIN must be at least 4 digits' };
    const { data: existing, error: existErr } = await supabase.from('user_accounts').select('id').eq('phone', normalizedPhone).maybeSingle();
    if (existErr && (existErr.code === '42P01' || existErr.message?.includes('relation') || existErr.message?.includes('does not exist'))) {
      return { success: false, error: 'Database not set up. Run supabase_schema.sql in your Supabase SQL Editor first.' };
    }
    if (existing) return { success: false, error: 'Phone already registered. Please sign in.' };
    const { data: member, error: memErr } = await supabase.from('members').insert({
      full_name: fullName,
      phone: normalizedPhone,
      kyc_verified: false,
      is_active: true,
      photo_url: photoDataUrl || null,
    }).select('id').single();
    if (memErr || !member) return { success: false, error: memErr?.message || 'Failed to create account. Please try again.' };
    const pinHash = await hashPin(pin);
    const { error: accErr } = await supabase.from('user_accounts').insert({ member_id: member.id, phone: normalizedPhone, pin_hash: pinHash });
    if (accErr) { await supabase.from('members').delete().eq('id', member.id); return { success: false, error: 'Failed to create account.' }; }
    if (inviteCode) {
      const { data: grp } = await supabase.from('groups').select('id').eq('invite_code', inviteCode.toUpperCase()).maybeSingle();
      if (grp) await supabase.from('group_memberships').insert({ group_id: grp.id, member_id: member.id, role: 'member', is_active: true });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'register', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  // Login
  const login = async (phone: string, pin: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    const pinHash = await hashPin(pin);
    const { data: acc, error: accErr } = await supabase.from('user_accounts').select('id, member_id, pin_hash, is_active').eq('phone', normalizedPhone).maybeSingle();
    if (accErr && (accErr.code === '42P01' || accErr.message?.includes('relation') || accErr.message?.includes('does not exist'))) {
      return { success: false, error: 'Database not set up. Run supabase_schema.sql in your Supabase SQL Editor first.' };
    }
    if (!acc) return { success: false, error: 'Account not found. Please register first.' };
    if (!acc.is_active) return { success: false, error: 'Account deactivated. Contact support.' };
    if (acc.pin_hash !== pinHash) return { success: false, error: 'Invalid PIN. Please try again.' };
    await supabase.from('otp_codes').update({ is_used: true }).eq('phone', normalizedPhone).eq('is_used', false);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'login', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  // Verify OTP
  const verifyOtp = async (phone: string, otpCode: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    const { data: otpRec } = await supabase.from('otp_codes').select('id, code, expires_at').eq('phone', normalizedPhone).eq('is_used', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!otpRec) return { success: false, error: 'No pending OTP. Please request a new one.' };
    if (new Date(otpRec.expires_at) < new Date()) { await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id); return { success: false, error: 'OTP expired. Please request a new one.' }; }
    if (otpRec.code !== otpCode) return { success: false, error: 'Invalid OTP code.' };
    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id);
    const { data: acc } = await supabase.from('user_accounts').select('id, member_id').eq('phone', normalizedPhone).single();
    if (!acc) return { success: false, error: 'Account not found.' };
    await supabase.from('user_accounts').update({ last_login_at: new Date().toISOString() }).eq('id', acc.id);
    const { data: mem } = await supabase.from('members').select('*').eq('id', acc.member_id).single();
    if (!mem) return { success: false, error: 'Member profile not found.' };
    const authUser: AuthUser = {
      id: acc.id, member_id: acc.member_id, phone: normalizedPhone,
      full_name: mem.full_name, email: mem.email, national_id: mem.national_id,
      photo_url: mem.photo_url, kyc_verified: mem.kyc_verified, created_at: mem.created_at,
    };
    setUser(authUser);
    await loadMemberships(acc.member_id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user_account_id: acc.id, member_id: acc.member_id, expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString() }));
    await supabase.from('audit_logs').insert({ actor_id: acc.member_id, action: 'user_login', entity_type: 'auth_session', details: { phone: normalizedPhone } });
    return { success: true };
  };

  // Resend OTP
  const resendOtp = async (phone: string) => {
    const normalizedPhone = normPhone(phone);
    await supabase.from('otp_codes').update({ is_used: true }).eq('phone', normalizedPhone).eq('is_used', false);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'login', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, demoOtp: otp };
  };

  // Logout
  const logout = () => {
    if (user) {
      supabase.from('audit_logs').insert({ actor_id: user.member_id, action: 'user_logout', entity_type: 'auth_session', details: { phone: user.phone } });
    }
    setUser(null);
    setMemberships([]);
    setGroups([]);
    setSelectedGroupIdState(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('saccoup_selected_group');
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar,
      user, memberships, isAuthenticated: !!user, isAuthLoading, authError,
      groups, selectedGroupId, selectedGroup, setSelectedGroupId, refreshGroups,
      register, login, verifyOtp, resendOtp, logout, clearAuthError,
    }}>
      {children}
    </AppContext.Provider>
  );
};

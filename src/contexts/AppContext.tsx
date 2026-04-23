import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  is_default_pin?: boolean; // Added to track default PIN status
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
  needsSetup: boolean; // Added to the interface
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
  // Role-based permissions
  isChairman: boolean;
  isTreasurer: boolean;
  isAdmin: boolean;
  isElevated: boolean; // chairman, treasurer, or admin
  // Auth actions
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

  // Logic to detect if first-time setup is required
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

  const refreshGroups = useCallback(async (memberId?: string) => {
    const mid = memberId || user?.member_id;
    if (!mid) return;
    try {
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

      if (mErr) return;

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

  useEffect(() => {
    if (user?.member_id) {
      refreshGroups(user.member_id);
    }
  }, [user?.member_id, refreshGroups]);

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

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) { setIsAuthLoading(false); return; }
        const session = JSON.parse(stored);
        if (!session.user_account_id || !session.member_id) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        
        const { data: acc } = await supabase.from('user_accounts').select('is_active, phone, pin_hash').eq('id', session.user_account_id).maybeSingle();
        if (!acc || !acc.is_active) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        
        const { data: mem } = await supabase.from('members').select('*').eq('id', session.member_id).maybeSingle();
        if (!mem) { localStorage.removeItem(SESSION_KEY); setIsAuthLoading(false); return; }
        
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
          is_default_pin: acc.pin_hash === DEFAULT_PIN_HASH
        });
        await loadMemberships(session.member_id);
      } catch (e) { localStorage.removeItem(SESSION_KEY); }
      setIsAuthLoading(false);
    };
    restoreSession();
  }, [loadMemberships]);

  const register = async (phone: string, pin: string, fullName: string, inviteCode: string, photoDataUrl: string, nationalId: string, email: string, dateOfBirth: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    if (pin.length < 4) return { success: false, error: 'PIN must be at least 4 digits' };
    
    const normalizedCode = inviteCode.trim().toUpperCase();
    const { data: grp } = await supabase.from('groups').select('id, name, is_active').eq('invite_code', normalizedCode).maybeSingle();
    
    if (!grp) return { success: false, error: 'Invalid invite code.' };

    let dob = null;
    if (dateOfBirth) {
      const parts = dateOfBirth.split('/');
      if (parts.length === 3) dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const { data: member, error: memErr } = await supabase.from('members').insert({
      full_name: fullName,
      phone: normalizedPhone,
      email: email || null,
      national_id: nationalId || null,
      date_of_birth: dob,
      kyc_verified: false,
      is_active: true,
      photo_url: photoDataUrl || null,
    }).select('id').single();

    if (memErr || !member) return { success: false, error: 'Failed to create member.' };

    const pinHash = await hashPin(pin);
    const { error: accErr } = await supabase.from('user_accounts').insert({ member_id: member.id, phone: normalizedPhone, pin_hash: pinHash });
    
    if (accErr) return { success: false, error: 'Failed to create account.' };

    await supabase.from('group_memberships').insert({ group_id: grp.id, member_id: member.id, role: 'member', is_active: true });
    
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'register', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  const login = async (phone: string, pin: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    const pinHash = await hashPin(pin);
    
    const { data: acc } = await supabase.from('user_accounts').select('id, pin_hash, is_active').eq('phone', normalizedPhone).maybeSingle();
    
    if (!acc) return { success: false, error: 'Account not found.' };
    if (!acc.is_active) return { success: false, error: 'Account deactivated.' };
    if (acc.pin_hash !== pinHash) return { success: false, error: 'Invalid PIN.' };
    
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'login', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, phone: normalizedPhone, demoOtp: otp };
  };

  const verifyOtp = async (phone: string, otpCode: string) => {
    setAuthError(null);
    const normalizedPhone = normPhone(phone);
    
    const { data: otpRec } = await supabase.from('otp_codes').select('id, code, expires_at').eq('phone', normalizedPhone).eq('is_used', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    
    if (!otpRec || otpRec.code !== otpCode) return { success: false, error: 'Invalid or expired OTP.' };
    
    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRec.id);
    
    const { data: acc } = await supabase.from('user_accounts').select('id, member_id, pin_hash').eq('phone', normalizedPhone).maybeSingle();
    if (!acc) return { success: false, error: 'Account not found.' };
    
    const { data: mem } = await supabase.from('members').select('*').eq('id', acc.member_id).single();
    
    const authUser: AuthUser = {
      id: acc.id, member_id: acc.member_id, phone: normalizedPhone,
      full_name: mem.full_name, email: mem.email, national_id: mem.national_id,
      photo_url: mem.photo_url, kyc_verified: mem.kyc_verified, created_at: mem.created_at,
      is_default_pin: acc.pin_hash === DEFAULT_PIN_HASH
    };

    setUser(authUser);
    await loadMemberships(acc.member_id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user_account_id: acc.id, member_id: acc.member_id, expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString() }));
    return { success: true };
  };

  const resendOtp = async (phone: string) => {
    const normalizedPhone = normPhone(phone);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('otp_codes').insert({ phone: normalizedPhone, code: otp, purpose: 'login', expires_at: new Date(Date.now() + 600000).toISOString() });
    return { success: true, demoOtp: otp };
  };

  const logout = () => {
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
      user, needsSetup, memberships, isAuthenticated: !!user, isAuthLoading, authError,
      groups, selectedGroupId, selectedGroup, setSelectedGroupId, refreshGroups,
      isChairman, isTreasurer, isAdmin, isElevated,
      register, login, verifyOtp, resendOtp, logout, clearAuthError,
    }}>
      {children}
    </AppContext.Provider>
  );
};

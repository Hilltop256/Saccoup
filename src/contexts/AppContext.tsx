import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
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

export interface Group {
  id: string;
  name: string;
  group_type: string;
  contribution_amount: number;
  contribution_schedule: string;
  invite_code: string;
  members_count?: number;
  total_savings?: number;
  user_role?: string;
}

interface AppContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;

  groups: Group[];
  selectedGroupId: string | null;
  selectedGroup: Group | null;

  setSelectedGroupId: (id: string | null) => void;
  refreshGroups: () => Promise<void>;

  register: (...args: any[]) => Promise<any>;
  login: (...args: any[]) => Promise<any>;
  verifyOtp: (...args: any[]) => Promise<any>;
  resendOtp: (...args: any[]) => Promise<any>;
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
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ✅ FIXED: hooks now INSIDE component
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const selectedGroup =
    groups.find(g => g.id === selectedGroupId) || null;

 const refreshGroups = useCallback(async () => {
  if (!user?.member_id) return;

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      groups (
        id,
        name,
        group_type,
        contribution_amount,
        contribution_schedule,
        invite_code
      )
    `)
    .eq('member_id', user.member_id);

  if (error) {
    console.error('refreshGroups error:', error);
    return;
  }

  const formatted: Group[] = (data || [])
    .filter((item: any) => item.groups) // ✅ IMPORTANT SAFETY FIX
    .map((item: any) => ({
      id: item.groups.id,
      name: item.groups.name,
      group_type: item.groups.group_type,
      contribution_amount: item.groups.contribution_amount,
      contribution_schedule: item.groups.contribution_schedule,
      invite_code: item.groups.invite_code,
      members_count: 0,
      total_savings: 0,
      user_role: item.role,
    }));

  setGroups(formatted);

  // ✅ FIX: always ensure selectedGroup is valid
  setSelectedGroupId(prev => {
    if (formatted.length === 0) return null;

    const stillExists = formatted.find(g => g.id === prev);
    return stillExists ? prev : formatted[0].id;
  });
}, [user]);

  useEffect(() => {
  if (!user) return;

  refreshGroups();
}, [user]);

await supabase.from('group_members').insert(...)
await refreshGroups();
}



    const formatted: Group[] = (data || []).map((item: any) => ({
      id: item.groups.id,
      name: item.groups.name,
      group_type: item.groups.group_type,
      contribution_amount: item.groups.contribution_amount,
      contribution_schedule: item.groups.contribution_schedule,
      invite_code: item.groups.invite_code,
      members_count: 0,
      total_savings: 0,
      user_role: item.role,
    }));

    setGroups(formatted);

    if (formatted.length > 0 && !selectedGroupId) {
      setSelectedGroupId(formatted[0].id);
    }
  }, [user, selectedGroupId]);

  useEffect(() => {
    if (user) refreshGroups();
  }, [user, refreshGroups]);

  // Restore session (unchanged)
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

        groups,
        selectedGroupId,
        setSelectedGroupId,
        selectedGroup,
        refreshGroups,

        register: async () => ({ success: true }),
        login: async () => ({ success: true }),
        verifyOtp: async () => ({ success: true }),
        resendOtp: async () => ({ success: true }),

        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

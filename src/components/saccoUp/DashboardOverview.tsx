import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';
import { formatUGX, getStatusColor, IMAGES } from '@/lib/constants';
import type { DashboardPage } from './Sidebar';

interface DashboardOverviewProps {
  onNavigate: (page: DashboardPage) => void;
}

interface GroupStats {
  total_savings: number;
  total_loans_outstanding: number;
  member_count: number;
  total_contributions: number;
  confirmed_contributions: number;
  pending_contributions: number;
  failed_contributions: number;
  pending_loans: number;
  collection_rate: number;
}

interface ContributionRow {
  id: string;
  member_name: string;
  member_id: string;
  amount: number;
  payment_method: string;
  status: string;
  period_label: string;
  created_at: string;
}

interface LoanRow {
  id: string;
  member_name: string;
  member_id: string;
  amount: number;
  purpose: string;
  status: string;
  created_at: string;
}

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author: string;
  is_pinned: boolean;
  created_at: string;
}

interface MemberRow {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  photo_url?: string;
  kyc_verified: boolean;
  total_contributions: number;
  savings_balance: number;
  loan_balance: number;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-7 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-200 rounded w-20" />
      </div>
      <div className="w-10 h-10 rounded-lg bg-gray-200" />
    </div>
  </div>
);

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals, cycles } = useRoscaData();

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roscaTotals = getGroupTotals();
  
  // 1. Identify the current Active Cycle and Draw
  const activeCycle = useMemo(() => cycles?.find(c => c.status === 'active') || cycles?.[0], [cycles]);
  
  const currentDrawNum = useMemo(() => {
    if (!activeCycle?.draws) return 1;
    const completedDraws = activeCycle.draws.filter(d => d.status === 'completed' || d.winner_name).length;
    // Assuming 2 slots per draw based on your previous logic
    return Math.ceil((completedDraws || 0) / 2) || 1;
  }, [activeCycle]);

// 2. Map member status based on Cumulative Cycle Savings
const memberStatusMap = useMemo(() => {
  if (!activeCycle || !activeCycle.draws || !members.length) return {};

  const statusMap: Record<string, string> = {};

  members.forEach(member => {
    // Look for draws matching this specific member
  const memberStatusMap = useMemo(() => {
  if (!members.length) return {};

  const statusMap: Record<string, string> = {};

  members.forEach(member => {
    const totalCycleSavings = Number(member.savings_balance) || 0;

    if (totalCycleSavings >= 500000) {
      statusMap[member.id] = 'confirmed';
    } else if (totalCycleSavings > 0) {
      statusMap[member.id] = 'partial payment';
    } else {
      statusMap[member.id] = 'defaulted';
    }
  });

  return statusMap;
}, [members]);

  // 3. Updated Tally to include Partial Payments
const roscaStats = useMemo(() => {
  const vals = Object.values(memberStatusMap);
  return {
    confirmed: vals.filter(v => v === 'confirmed').length,
    partial: vals.filter(v => v === 'partial payment').length,
    defaulted: vals.filter(v => v === 'defaulted').length
  };
}, [memberStatusMap]);

  const loadDashboardData = useCallback(async () => {
    if (!selectedGroup?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const [statsRes, contribRes, loansRes, announcementsRes, membersRes] = await Promise.allSettled([
        ds.getGroupStats(selectedGroup.id),
        ds.listContributions(selectedGroup.id, { limit: 10 }),
        ds.listLoans(selectedGroup.id),
        ds.listAnnouncements(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        const s = statsRes.value.stats;
        setStats({
          total_savings: s.total_savings || 0,
          total_loans_outstanding: s.total_loans_outstanding || 0,
          member_count: s.member_count || 0,
          total_contributions: s.total_contributions || 0,
          confirmed_contributions: s.confirmed_contributions || 0,
          pending_contributions: s.pending_contributions || 0,
          failed_contributions: s.failed_contributions || 0,
          pending_loans: s.pending_loans || 0,
          collection_rate: s.collection_rate || 0,
        });
      }

      if (contribRes.status === 'fulfilled' && contribRes.value?.contributions) {
        setContributions(contribRes.value.contributions.map((c: any) => ({
          id: c.id,
          member_name: c.member_name || 'Unknown',
          member_id: c.member_id,
          amount: c.amount || 0,
          payment_method: c.payment_method || '',
          status: c.status || 'pending',
          period_label: c.period_label || '',
          created_at: c.created_at?.split('T')[0] || '',
        })));
      }

      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans.map((l: any) => ({
          id: l.id,
          member_name: l.member_name || 'Unknown',
          member_id: l.member_id,
          amount: l.amount || 0,
          purpose: l.purpose || '',
          status: l.status || 'pending',
          created_at: l.created_at?.split('T')[0] || '',
        })));
      }

      if (membersRes.status === 'fulfilled' && membersRes.value?.members) {
        setMembers(membersRes.value.members.map((m: any) => ({
          id: m.id,
          full_name: m.full_name || 'Unknown',
          phone: m.phone || '',
          role: m.role || 'member',
          photo_url: m.photo_url,
          kyc_verified: m.kyc_verified || false,
          total_contributions: m.total_contributions || 0,
          savings_balance: m.savings_balance || 0,
          loan_balance: m.loan_balance || 0,
        })));
      }
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError('Failed to load dashboard data');
    }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (!selectedGroup) return <div className="p-8 text-center text-gray-500 font-medium">Please select a group to view the dashboard.</div>;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-gray-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  const userName = user?.full_name?.split(' ')[0] || 'User';
  const groupType = (selectedGroup?.group_type || '').toLowerCase();
  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';
  const activeLoansList = loans.filter((l: any) => ['pending', 'approved', 'treasurer_approved'].includes(l.status));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-bold">Welcome back, {userName}!</h1>
          <p className="mt-2 text-blue-100">
            {isRoscaType 
              ? `Currently in Cycle ${activeCycle?.cycle_number || 1}, Draw ${currentDrawNum}.` 
              : `Managing ${selectedGroup.name}.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('contributions')} className="px-4 py-2 bg-white text-[#0066CC] rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
              Record Contribution
            </button>
            {isRoscaType && (
              <button onClick={() => onNavigate('rosca')} className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors">
                View Cycle Details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Combined Savings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatUGX((stats?.total_savings || 0) + (roscaTotals.totalSavings || 0))}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">ROSCA Payouts</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatUGX(roscaTotals.totalPaidOut || 0)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Active Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{members.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Loan Portfolio</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatUGX(stats?.total_loans_outstanding || 0)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ROSCA Tracker Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Cycle {activeCycle?.cycle_number || 1} • Draw {currentDrawNum} Status
              </h2>
              <p className="text-xs text-gray-500 mt-1">Per-member contribution tracking</p>
            </div>
            <button onClick={() => onNavigate('rosca')} className="text-xs text-[#0066CC] font-bold hover:underline">Manage Draw</button>
          </div>
          
          {members.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
{members.map(m => {
  const status = memberStatusMap[m.id] || 'defaulted';
  const isConfirmed = status === 'confirmed';
  const isPartial = status === 'partial payment';
  const isDefaulted = status === 'defaulted';

  return (
    <div 
      key={m.id} 
      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
        isConfirmed ? 'bg-emerald-50 border-emerald-100' : 
        isPartial ? 'bg-amber-50 border-amber-100' : 
        'bg-red-50 border-red-100'
      }`}
    >
      <div className="relative">
        <img 
          src={m.photo_url || IMAGES.avatars[0]} 
          className={`w-10 h-10 rounded-full border-2 ${
            isConfirmed ? 'border-emerald-500' : 
            isPartial ? 'border-amber-500' : 
            'border-red-500'
          }`}
          alt="" 
        />
        {isConfirmed && (
          <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-[11px] font-bold text-gray-800 mt-2 truncate w-full text-center">
        {m.full_name.split(' ')[0]}
      </span>
      <span className={`text-[9px] uppercase font-black mt-1 ${
        isConfirmed ? 'text-emerald-600' : 
        isPartial ? 'text-amber-600' : 
        'text-red-600'
      }`}>
        {status}
      </span>
    </div>
  );
})}
</div>

            {/* Status Totals Tally */}
<div className="flex items-center justify-around py-4 bg-gray-50 rounded-xl border border-gray-100">
  <div className="text-center">
    <p className="text-xl font-black text-emerald-600">{roscaStats.confirmed}</p>
    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Confirmed</p>
  </div>
  <div className="w-px h-8 bg-gray-200" />
  <div className="text-center">
    <p className="text-xl font-black text-amber-500">{roscaStats.partial}</p>
    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Partial</p>
  </div>
  <div className="w-px h-8 bg-gray-200" />
  <div className="text-center">
    <p className="text-xl font-black text-red-500">{roscaStats.defaulted}</p>
    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Defaulted</p>
  </div>
</div>
</div>
          ) : (
            <div className="text-center py-10 text-gray-400">No member data found for this group.</div>
          )}
        </div>

        {/* Loan Applications Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Active Loans</h2>
            <button onClick={() => onNavigate('loans')} className="text-sm text-[#0066CC] font-medium hover:underline">View All</button>
          </div>
          {activeLoansList.length > 0 ? (
            <div className="space-y-3">
              {activeLoansList.slice(0, 4).map((loan) => (
                <div key={loan.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{loan.member_name}</p>
                    <p className="text-xs text-gray-500 truncate">{loan.purpose}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{formatUGX(loan.amount)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <p className="text-sm">No active loan requests.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          <button onClick={() => onNavigate('contributions')} className="text-sm text-[#0066CC] font-medium hover:underline">All History</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 font-semibold">Member</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Method</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contributions.slice(0, 5).map((c) => (
                <tr key={c.id} className="text-sm">
                  <td className="py-4 font-medium text-gray-900">{c.member_name}</td>
                  <td className="py-4 font-bold">{formatUGX(c.amount)}</td>
                  <td className="py-4 text-gray-500 capitalize">{c.payment_method.replace('_', ' ')}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {contributions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400 text-sm">No recent contributions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;

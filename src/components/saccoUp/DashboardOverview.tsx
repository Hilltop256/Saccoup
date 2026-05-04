import React, { useState, useEffect, useCallback } from 'react';
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

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
    <div className="w-9 h-9 rounded-full bg-gray-200" />
    <div className="flex-1 space-y-1">
      <div className="h-3 bg-gray-200 rounded w-28" />
      <div className="h-2 bg-gray-200 rounded w-20" />
    </div>
    <div className="space-y-1 text-right">
      <div className="h-3 bg-gray-200 rounded w-20 ml-auto" />
      <div className="h-2 bg-gray-200 rounded w-14 ml-auto" />
    </div>
  </div>
);

const getPaymentLabel = (method: string): string => {
  switch (method) {
    case 'mtn_momo': return 'MTN MoMo';
    case 'airtel_money': return 'Airtel Money';
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
    default: return method || 'N/A';
  }
};

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals } = useRoscaData();

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
   // ✅ MOVE IT HERE
  const [cycleStatuses, setCycleStatuses] = useState<Record<string, string>>({});

  const roscaTotals = getGroupTotals();
  const roscaCycles = useRoscaData().cycles;
  // Get current active/upcoming cycle, or default to cycle 4 if just completed cycle 3
  const activeCycle = roscaCycles?.find(c => c.status === 'active' || c.status === 'upcoming');
  const currentCycleNum = activeCycle?.cycle_number || 4;
  // Get the draw number for current cycle (count wins in this cycle + 1 for next)
  const activeDraw = activeCycle?.draws?.find(d => d.status === 'active');
  const currentDrawId = activeDraw?.id;

  const loadDashboardData = useCallback(async () => {
    if (!selectedGroup?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [statsRes, contribRes, loansRes, announcementsRes, membersRes] = await Promise.allSettled([
        ds.getGroupStats(selectedGroup.id),
        ds.listContributions(selectedGroup.id, { limit: 10 }),
        ds.listLoans(selectedGroup.id),
        ds.listAnnouncements(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);

      // Process stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.stats) {
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
      } else {
        setStats({
          total_savings: 0, total_loans_outstanding: 0, member_count: 0,
          total_contributions: 0, confirmed_contributions: 0, pending_contributions: 0,
          failed_contributions: 0, pending_loans: 0, collection_rate: 0,
        });
      }

      // Fetch ROSCA contribution statuses for current cycle/draw
let statusMap: Record<string, string> = {};

if (activeCycle?.id) {
  try {
    const res = await ds.getRoscaContributionStatus(
  activeCycle.id,
  currentDrawId
);

    if (res?.data) {
      res.data.forEach((row: any) => {
        statusMap[row.member_id] = row.status || 'pending';
      });
    }
  } catch (e) {
    console.warn('Failed to fetch rosca contribution status', e);
  }
}

setCycleStatuses(statusMap);

      // Process contributions
      if (contribRes.status === 'fulfilled' && contribRes.value?.contributions) {
        setContributions(contribRes.value.contributions.map((c: any) => ({
          id: c.id,
          member_name: c.member_name || c.members?.full_name || 'Unknown',
          member_id: c.member_id,
          amount: c.amount || 0,
          payment_method: c.payment_method || '',
          status: c.status || 'pending',
          period_label: c.period_label || '',
          created_at: c.created_at?.split('T')[0] || '',
        })));
      }

      // Process loans
      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans.map((l: any) => ({
          id: l.id,
          member_name: l.member_name || l.members?.full_name || 'Unknown',
          member_id: l.member_id,
          amount: l.amount || 0,
          purpose: l.purpose || '',
          status: l.status || 'pending',
          created_at: l.created_at?.split('T')[0] || '',
        })));
      }

      // Process announcements
      if (announcementsRes.status === 'fulfilled' && announcementsRes.value?.announcements) {
        setAnnouncements(announcementsRes.value.announcements.slice(0, 3).map((a: any) => ({
          id: a.id,
          title: a.title || '',
          content: a.content || '',
          author: a.author || 'Admin',
          is_pinned: a.is_pinned || false,
          created_at: a.created_at?.split('T')[0] || '',
        })));
      }

      // Process members
      if (membersRes.status === 'fulfilled' && membersRes.value?.members) {
        setMembers(membersRes.value.members.map((m: any) => ({
          id: m.id,
          full_name: m.full_name || 'Unknown',
          phone: m.phone || '',
          role: m.role || 'member',
          photo_url: m.photo_url,
          kyc_verified: m.kyc_verified || false,
          total_contributions: m.totalContributions || m.total_contributions || 0,
          savings_balance: m.savingsBalance || m.savings_balance || 0,
          loan_balance: m.loanBalance || m.loan_balance || 0,
        })));
      }
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e.message || 'Failed to load dashboard data');
    }

    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const userName = user?.full_name?.split(' ')[0] || 'User';
  const groupName = selectedGroup?.name || 'your group';

  const getMemberStatusUI = (status: string) => {
  switch (status) {
    case 'paid':
      return {
        color: 'bg-emerald-50 border-emerald-300 text-emerald-700',
        icon: '✅',
      };
    case 'defaulted':
      return {
        color: 'bg-red-50 border-red-300 text-red-700',
        icon: '❌',
      };
    default:
      return {
        color: 'bg-amber-50 border-amber-300 text-amber-700',
        icon: '⏳',
      };
  }
};

  // No group selected empty state
  if (!selectedGroup) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] rounded-2xl p-8 lg:p-12 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold">Welcome, {userName}!</h1>
            <p className="mt-3 text-blue-200">You haven't joined or created a savings group yet. Get started by creating your first group or joining one with an invite code.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => onNavigate('groups')} className="px-6 py-2.5 bg-white text-[#0066CC] rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
                Create a Group
              </button>
              <button onClick={() => onNavigate('groups')} className="px-6 py-2.5 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors">
                Join with Invite Code
              </button>
            </div>
          </div>
        </div>

        {/* Getting Started Steps */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Getting Started</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Create a Group', desc: 'Set up your savings group with contribution rules and schedules.', icon: 'M12 4.5v15m7.5-7.5h-15' },
              { step: '2', title: 'Invite Members', desc: 'Share the invite code with your group members to join.', icon: 'M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z' },
              { step: '3', title: 'Start Saving', desc: 'Record contributions, manage loans, and track your group\'s growth.', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
            ].map((item) => (
              <div key={item.step} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-[#0066CC] text-white flex items-center justify-center text-sm font-bold mb-3">{item.step}</div>
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Compute derived values
  const groupType = (selectedGroup?.group_type || '').toLowerCase();
  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';
  const isInsuranceType = groupType === 'insurance';

  const totalMembers = Math.max(stats?.member_count || 0, members.length);
  const confirmedCount = Object.values(cycleStatuses).filter(s => s === 'paid').length;
  const pendingCount = Object.values(cycleStatuses).filter(s => s === 'pending').length;
  const failedCount = Object.values(cycleStatuses).filter(s => s === 'defaulted').length;
  const collectionRate = stats?.collection_rate || 0;
  const pendingLoansCount = loans.filter((l: any) => l.status === 'pending' || l.status === 'treasurer_approved').length;
  const activeLoansList = loans.filter((l: any) => l.status === 'pending' || l.status === 'approved' || l.status === 'treasurer_approved');

  const statCards = isRoscaType ? [
    // ROSCA/Hybrid stat cards
    {
      label: 'Total Combined Savings',
      value: formatUGX((stats?.total_savings || 0) + roscaTotals.totalSavings),
      change: `SACCO: ${formatUGX(stats?.total_savings || 0)} + ROSCA: ${formatUGX(roscaTotals.totalSavings)}`,
      color: 'from-[#0066CC] to-[#0088FF]',
      icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    },
    {
      label: 'ROSCA Total Paid Out',
      value: formatUGX(roscaTotals.totalPaidOut),
      change: `${roscaTotals.totalWinners} winners across all cycles`,
      color: 'from-emerald-500 to-emerald-400',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'Active Members',
      value: totalMembers.toString(),
      change: `${confirmedCount} contributed this period`,
      color: 'from-[#00CC99] to-[#00E6AD]',
      icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    },
    {
      label: 'Outstanding Loans',
      value: formatUGX(stats?.total_loans_outstanding || 0),
      change: pendingLoansCount > 0 ? `${pendingLoansCount} pending` : 'No pending loans',
      color: 'from-amber-500 to-amber-400',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ] : [
    // Savings Club / Investment Club / SACCO stat cards
    {
      label: 'Total Savings',
      value: formatUGX(stats?.total_savings || 0),
      change: `${collectionRate}% collection rate`,
      color: 'from-[#0066CC] to-[#0088FF]',
      icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    },
    {
      label: 'Total Contributions',
      value: formatUGX(stats?.total_contributions || 0),
      change: `${confirmedCount} confirmed, ${pendingCount} pending`,
      color: 'from-emerald-500 to-emerald-400',
      icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'Active Members',
      value: totalMembers.toString(),
      change: `${confirmedCount} contributed this period`,
      color: 'from-[#00CC99] to-[#00E6AD]',
      icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    },
    {
      label: 'Outstanding Loans',
      value: formatUGX(stats?.total_loans_outstanding || 0),
      change: pendingLoansCount > 0 ? `${pendingLoansCount} pending` : 'No pending loans',
      color: 'from-amber-500 to-amber-400',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-bold">Welcome back, {userName}!</h1>
          <p className="mt-2 text-blue-200 max-w-lg">
            {totalMembers > 0
              ? `${groupName} has ${totalMembers} member${totalMembers !== 1 ? 's' : ''}. ${isRoscaType ? 'Manage your Merry-Go-Round cycles and track payouts.' : confirmedCount > 0 ? `${confirmedCount} of ${totalMembers} members have contributed.` : 'Start by recording contributions.'}`
              : `${groupName} is ready. Start by adding members and recording contributions.`
            }
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('contributions')} className="px-4 py-2 bg-white text-[#0066CC] rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
              Record Contribution
            </button>
            {isRoscaType && (
              <button onClick={() => onNavigate('rosca')} className="px-4 py-2 bg-white text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors">
                🎡 Merry-Go-Round
              </button>
            )}
            {(groupType === 'savings_club' || groupType === 'investment_club' || groupType === 'sacco') && (
              <button onClick={() => onNavigate('loans')} className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors">
                Review Loan Applications
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { setError(null); loadDashboardData(); }} className="text-red-600 font-medium hover:underline text-xs">Retry</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          statCards.map((card, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-xs text-[#00CC99] font-medium mt-1">{card.change}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                  </svg>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Card 1: Contribution Tracker - wider to fit all members */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">📋 C{currentCycleNum}D{currentDrawNum} Contributions</h2>
            <button onClick={() => onNavigate('rosca')} className="text-xs text-purple-600 font-medium hover:underline">Full View</button>
          </div>
          {totalMembers > 0 ? (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
               {members.map(m => {
  const status = cycleStatuses[m.id] || 'pending';
  const ui = getMemberStatusUI(status);

  return (
    <button
      key={m.id}
      className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${ui.color}`}
    >
      <span className="mr-1">{ui.icon}</span>
      {m.full_name.split(' ')[0]}
    </button>
  );
})}
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <span className="text-emerald-600">✅ {confirmedCount} paid</span>
                <span className="text-amber-600">⏳ {pendingCount} pending</span>
                <span className="text-red-600">❌ {failedCount} defaulted</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No members</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">🏆 Recent Winners</h2>
            <button onClick={() => onNavigate('rosca')} className="text-xs text-[#0066CC] font-medium hover:underline">Full History</button>
          </div>
          {roscaTotals.totalWinners > 0 ? (
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-gray-50 text-center text-sm text-gray-400">Winners from past draws</div>
            </div>
) : (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400">
              <p className="text-sm font-medium">No winners yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Contribution Collection */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
            <button onClick={() => onNavigate('contributions')} className="text-sm text-[#0066CC] font-medium hover:underline">View All</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : contributions.length > 0 ? (
            <div className="space-y-3">
              {contributions.slice(0, 5).map((c) => {
                const memberIdx = members.findIndex(m => m.id === c.member_id);
                const avatarUrl = members[memberIdx]?.photo_url || IMAGES.avatars[memberIdx % IMAGES.avatars.length] || IMAGES.avatars[0];
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.member_name}</p>
                      <p className="text-xs text-gray-500">{c.period_label} - {getPaymentLabel(c.payment_method)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatUGX(c.amount)}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(c.status)}`}>{c.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="text-xs mt-1">Record your first contribution to get started</p>
              <button onClick={() => onNavigate('contributions')} className="mt-3 px-4 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20">
                Record Contribution
              </button>
            </div>
          )}
        </div>

        {/* Pending Loans & Announcements */}
        <div className="space-y-6">
          {/* Pending Loans */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Loan Applications</h2>
              <button onClick={() => onNavigate('loans')} className="text-sm text-[#0066CC] font-medium hover:underline">View All</button>
            </div>
            {loading ? (
              <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
            ) : activeLoansList.length > 0 ? (
              <div className="space-y-3">
                {activeLoansList.slice(0, 4).map((loan) => (
                  <div key={loan.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{loan.member_name}</p>
                      <p className="text-xs text-gray-500 truncate">{loan.purpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatUGX(loan.amount)}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(loan.status)}`}>{loan.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">No pending loans</p>
                <p className="text-xs mt-1">All loan applications are processed</p>
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
              <button onClick={() => onNavigate('announcements')} className="text-sm text-[#0066CC] font-medium hover:underline">View All</button>
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-gray-100 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-40 mb-2" />
                  <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-2 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ) : announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.slice(0, 2).map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      {a.is_pinned && (
                        <svg className="w-3 h-3 text-[#0066CC]" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" /></svg>
                      )}
                      <h3 className="text-sm font-semibold text-gray-900">{a.title}</h3>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{a.author} - {a.created_at}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                </svg>
                <p className="text-sm font-medium">No announcements</p>
                <button onClick={() => onNavigate('announcements')} className="mt-2 px-4 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20">
                  Create Announcement
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Member Quick View */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Members Overview</h2>
          <button onClick={() => onNavigate('members')} className="text-sm text-[#0066CC] font-medium hover:underline">Manage Members</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="text-center animate-pulse">
                <div className="w-14 h-14 rounded-full bg-gray-200 mx-auto mb-2" />
                <div className="h-2 bg-gray-200 rounded w-12 mx-auto mb-1" />
                <div className="h-2 bg-gray-200 rounded w-8 mx-auto" />
              </div>
            ))}
          </div>
        ) : members.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {members.map((m, idx) => (
              <div key={m.id} className="text-center group cursor-pointer" onClick={() => onNavigate('members')}>
                <div className="relative mx-auto w-14 h-14 mb-2">
                  <img
                    src={m.photo_url || IMAGES.avatars[idx % IMAGES.avatars.length]}
                    alt={m.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 group-hover:border-[#0066CC] transition-colors"
                    onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[idx % IMAGES.avatars.length]; }}
                  />
                  {m.kyc_verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00CC99] rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 truncate">{m.full_name.split(' ')[0]}</p>
                <p className="text-[10px] text-gray-500 capitalize">{m.role}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm font-medium">No members yet</p>
            <p className="text-xs mt-1">Add members to your group to get started</p>
            <button onClick={() => onNavigate('members')} className="mt-3 px-4 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20">
              Add Members
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;

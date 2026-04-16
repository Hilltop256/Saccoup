import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';
import { formatUGX, getStatusColor, IMAGES } from '@/lib/constants';
import type { DashboardPage } from './Sidebar';

interface DashboardOverviewProps {
  onNavigate: (page: DashboardPage) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals, cycles } = useRoscaData();

  const [stats, setStats] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roscaTotals = getGroupTotals();

  const activeCycle = useMemo(() => {
    return cycles?.find(c => c.status === 'active' || c.status === 'upcoming');
  }, [cycles]);

  const currentCycleNum = activeCycle?.cycle_number ?? 1;

  const currentDrawNum = useMemo(() => {
    return (activeCycle?.draws?.filter(d => d.winner_name).length ?? 0) + 1;
  }, [activeCycle]);

  const loadDashboardData = useCallback(async () => {
    if (!selectedGroup?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    try {
      const [
        statsRes,
        contribRes,
        loansRes,
        announcementsRes,
        membersRes,
      ] = await Promise.allSettled([
        ds.getGroupStats(selectedGroup.id),
        ds.listContributions(selectedGroup.id, { limit: 10 }),
        ds.listLoans(selectedGroup.id),
        ds.listAnnouncements(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);

      if (!isMounted) return;

      // Stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.stats) {
        setStats(statsRes.value.stats);
      } else {
        setStats({
          total_savings: 0,
          total_loans_outstanding: 0,
          member_count: 0,
          total_contributions: 0,
          confirmed_contributions: 0,
          pending_contributions: 0,
          failed_contributions: 0,
          pending_loans: 0,
          collection_rate: 0,
        });
      }

      // Contributions
      if (contribRes.status === 'fulfilled') {
        setContributions(contribRes.value?.contributions ?? []);
      }

      // Loans
      if (loansRes.status === 'fulfilled') {
        setLoans(loansRes.value?.loans ?? []);
      }

      // Announcements
      if (announcementsRes.status === 'fulfilled') {
        setAnnouncements((announcementsRes.value?.announcements ?? []).slice(0, 3));
      }

      // Members
      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value?.members ?? []);
      }

    } catch (e: any) {
      if (!isMounted) return;
      setError(e?.message || 'Failed to load dashboard data');
    }

    if (isMounted) setLoading(false);

    return () => {
      isMounted = false;
    };
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (selectedGroup?.id) loadDashboardData();
  }, [selectedGroup?.id, loadDashboardData]);

  const userName = useMemo(
    () => user?.full_name?.split(' ')[0] || 'User',
    [user]
  );

  const groupType = useMemo(
    () => (selectedGroup?.group_type || '').toLowerCase(),
    [selectedGroup]
  );

  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';

  const totalMembers = useMemo(
    () => Math.max(stats?.member_count || 0, members.length),
    [stats, members]
  );

  const confirmedCount = stats?.confirmed_contributions || 0;
  const pendingCount = stats?.pending_contributions || 0;
  const failedCount = stats?.failed_contributions || 0;

  const pendingLoansCount = useMemo(
    () =>
      loans.filter(l =>
        ['pending', 'treasurer_approved'].includes(l.status)
      ).length,
    [loans]
  );

  const activeLoansList = useMemo(
    () =>
      loans.filter(l =>
        ['pending', 'approved', 'treasurer_approved'].includes(l.status)
      ),
    [loans]
  );

  const statCards = useMemo(() => {
    if (!stats) return [];

    const base = [
      {
        label: 'Total Savings',
        value: formatUGX(stats.total_savings),
        change: `${stats.collection_rate}% collection rate`,
        color: 'from-[#0066CC] to-[#0088FF]',
      },
      {
        label: 'Total Contributions',
        value: formatUGX(stats.total_contributions),
        change: `${confirmedCount} confirmed`,
        color: 'from-emerald-500 to-emerald-400',
      },
      {
        label: 'Active Members',
        value: String(totalMembers),
        change: `${confirmedCount} contributed`,
        color: 'from-[#00CC99] to-[#00E6AD]',
      },
      {
        label: 'Outstanding Loans',
        value: formatUGX(stats.total_loans_outstanding),
        change: `${pendingLoansCount} pending`,
        color: 'from-amber-500 to-amber-400',
      },
    ];

    return base;
  }, [stats, confirmedCount, totalMembers, pendingLoansCount]);

  const memberMap = useMemo(() => {
    const map = new Map();
    members.forEach(m => map.set(m.id, m));
    return map;
  }, [members]);

  if (!selectedGroup) {
    return (
      <div className="p-6 text-center text-gray-500">
        Select or create a group to continue.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome back, {userName}!
        </h1>
        <p className="text-blue-200 mt-2">
          {totalMembers} members in {selectedGroup.name}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
            ))
          : statCards.map((card, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-xs text-gray-400">{card.change}</p>
              </div>
            ))}
      </div>

      {/* Contributions */}
      <div className="bg-white p-4 rounded-xl border">
        <h2 className="font-bold mb-3">
          C{currentCycleNum}D{currentDrawNum} Contributions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {members.map(m => (
            <div key={m.id} className="text-xs bg-gray-50 p-2 rounded">
              {m.full_name?.split(' ')[0] || 'User'}
            </div>
          ))}
        </div>

        <div className="text-xs mt-3 text-gray-500">
          ✅ {confirmedCount} | ⏳ {pendingCount} | ❌ {failedCount}
        </div>
      </div>

      {/* Loans */}
      <div className="bg-white p-4 rounded-xl border">
        <h2 className="font-bold mb-3">Loan Applications</h2>

        {activeLoansList.slice(0, 4).map(l => {
          const member = memberMap.get(l.member_id);

          return (
            <div key={l.id} className="flex justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">
                  {member?.full_name || l.member_name}
                </p>
                <p className="text-xs text-gray-500">{l.purpose}</p>
              </div>
              <div className="text-right text-sm">
                {formatUGX(l.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardOverview;

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';
import { formatUGX } from '@/lib/constants';
import type { DashboardPage } from './Sidebar';

interface DashboardOverviewProps {
  onNavigate: (page: DashboardPage) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals, cycles } = useRoscaData();

  const [stats, setStats] = useState<any>({});
  const [contributions, setContributions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const roscaTotals = getGroupTotals();

  const activeCycle = useMemo(() => {
    return cycles?.find(c => c.status === 'active' || c.status === 'upcoming');
  }, [cycles]);

  const currentCycleNum = activeCycle?.cycle_number ?? 1;

  const currentDrawNum = useMemo(() => {
    return (activeCycle?.draws?.filter(d => d.winner_name)?.length ?? 0) + 1;
  }, [activeCycle]);

  const loadDashboardData = useCallback(async () => {
    const groupId = selectedGroup?.id;
    if (!groupId) return;

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
        ds.getGroupStats(groupId),
        ds.listContributions(groupId, { limit: 10 }),
        ds.listLoans(groupId),
        ds.listAnnouncements(groupId),
        ds.listMembers(groupId),
      ]);

      if (!mountedRef.current) return;

      // STATS
      setStats(
        statsRes.status === 'fulfilled'
          ? statsRes.value?.stats ?? {}
          : {}
      );

      // CONTRIBUTIONS
      setContributions(
        contribRes.status === 'fulfilled'
          ? contribRes.value?.contributions ?? []
          : []
      );

      // LOANS
      setLoans(
        loansRes.status === 'fulfilled'
          ? loansRes.value?.loans ?? []
          : []
      );

      // ANNOUNCEMENTS
      setAnnouncements(
        announcementsRes.status === 'fulfilled'
          ? (announcementsRes.value?.announcements ?? []).slice(0, 3)
          : []
      );

      // MEMBERS
      setMembers(
        membersRes.status === 'fulfilled'
          ? membersRes.value?.members ?? []
          : []
      );

    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to load dashboard data');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (selectedGroup?.id) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [selectedGroup?.id, loadDashboardData]);

  const userName = useMemo(
    () => user?.full_name?.split(' ')[0] || 'User',
    [user]
  );

  const groupType = useMemo(
    () => (selectedGroup?.group_type || '').toLowerCase(),
    [selectedGroup]
  );

  const totalMembers = members.length;

  const confirmedCount = stats?.confirmed_contributions || 0;
  const pendingCount = stats?.pending_contributions || 0;
  const failedCount = stats?.failed_contributions || 0;

  const pendingLoansCount = useMemo(
    () => (loans ?? []).filter(l =>
      ['pending', 'treasurer_approved'].includes(l.status)
    ).length,
    [loans]
  );

  const activeLoansList = useMemo(
    () => (loans ?? []).filter(l =>
      ['pending', 'approved', 'treasurer_approved'].includes(l.status)
    ),
    [loans]
  );

  const memberMap = useMemo(() => {
    const map = new Map();
    (members ?? []).forEach(m => map.set(m.id, m));
    return map;
  }, [members]);

  const statCards = useMemo(() => {
    return [
      {
        label: 'Total Savings',
        value: formatUGX(stats?.total_savings || 0),
        change: `${stats?.collection_rate || 0}% collection rate`,
      },
      {
        label: 'Total Contributions',
        value: formatUGX(stats?.total_contributions || 0),
        change: `${confirmedCount} confirmed`,
      },
      {
        label: 'Active Members',
        value: String(totalMembers),
        change: `${confirmedCount} contributed`,
      },
      {
        label: 'Outstanding Loans',
        value: formatUGX(stats?.total_loans_outstanding || 0),
        change: `${pendingLoansCount} pending`,
      },
    ];
  }, [stats, confirmedCount, totalMembers, pendingLoansCount]);

  if (!selectedGroup) {
    return (
      <div className="p-6 text-center text-gray-500">
        Select or create a group to continue.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
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
          : statCards.map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-xl font-bold">{c.value}</p>
                <p className="text-xs text-gray-400">{c.change}</p>
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

        {activeLoansList.length === 0 ? (
          <p className="text-xs text-gray-400">No loan applications</p>
        ) : (
          activeLoansList.slice(0, 4).map(l => {
            const member = memberMap.get(l.member_id);

            return (
              <div key={l.id} className="flex justify-between py-2 border-b">
                <div>
                  <p className="text-sm font-medium">
                    {member?.full_name || l.member_name}
                  </p>
                  <p className="text-xs text-gray-500">{l.purpose}</p>
                </div>
                <div className="text-sm">
                  {formatUGX(l.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;

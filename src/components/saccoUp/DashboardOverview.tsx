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
  member_id: string;
  full_name: string;
  phone: string;
  role: string;
  photo_url?: string;
  kyc_verified: boolean;
  total_contributions: number;
  savings_balance: number;
  loan_balance: number;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals, cycles, contributionStatuses } = useRoscaData();

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const roscaTotals = getGroupTotals();

  // Active Cycle
  const activeCycle = useMemo(
    () => cycles?.find(c => c.status === 'active') || cycles?.[0],
    [cycles]
  );

  const currentDrawNum = useMemo(() => {
    if (!activeCycle?.draws) return 1;
    const completed = activeCycle.draws.filter(
      d => d.status === 'completed' || d.winner_name
    ).length;
    return completed + 1;
  }, [activeCycle]);

  // Map statuses
  const memberStatusMap = useMemo(() => {
    if (!activeCycle || !contributionStatuses) return {};
    return contributionStatuses
      .filter(
        s =>
          s.cycle_id === activeCycle.id &&
          s.draw_number === currentDrawNum
      )
      .reduce((acc, curr) => {
        acc[curr.member_id] = curr.status;
        return acc;
      }, {} as Record<string, string>);
  }, [activeCycle, contributionStatuses, currentDrawNum]);

  const roscaStats = useMemo(() => {
    const vals = Object.values(memberStatusMap);
    return {
      paid: vals.filter(v => v === 'paid' || v === 'confirmed').length,
      pending: vals.filter(v => v === 'pending').length,
      failed: vals.filter(v => v === 'failed' || v === 'defaulted').length,
    };
  }, [memberStatusMap]);

  // Debug logs
  useEffect(() => {
    console.log("Statuses:", contributionStatuses);
    console.log("Member Map:", memberStatusMap);
    console.log("Members:", members);
  }, [contributionStatuses, memberStatusMap, members]);

  const loadDashboardData = useCallback(async () => {
    if (!selectedGroup?.id) return;

    setLoading(true);

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
        setContributions(contribRes.value.contributions);
      }

      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans);
      }

      if (announcementsRes.status === 'fulfilled' && announcementsRes.value?.announcements) {
        setAnnouncements(announcementsRes.value.announcements);
      }

      if (membersRes.status === 'fulfilled' && membersRes.value?.members) {
        setMembers(
          membersRes.value.members.map((m: any) => ({
            id: m.id,
            member_id: m.member_id || m.id,
            full_name: m.full_name || 'Unknown',
            phone: m.phone || '',
            role: m.role || 'member',
            photo_url: m.photo_url,
            kyc_verified: m.kyc_verified || false,
            total_contributions: m.total_contributions || 0,
            savings_balance: m.savings_balance || 0,
            loan_balance: m.loan_balance || 0,
          }))
        );
      }

    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (!selectedGroup) {
    return <div className="p-8 text-center">Select a group</div>;
  }

  return (
    <div>
      <h2>ROSCA Tracker</h2>

      {members.map(m => {
        const status = memberStatusMap[m.member_id] || 'pending';
        return (
          <div key={m.id}>
            {m.full_name} - {status}
          </div>
        );
      })}

      <div>
        Paid: {roscaStats.paid} | Pending: {roscaStats.pending} | Failed: {roscaStats.failed}
      </div>
    </div>
  );
};

export default DashboardOverview;

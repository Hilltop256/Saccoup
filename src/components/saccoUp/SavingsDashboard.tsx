import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getStatusColor, getScheduleLabel, IMAGES } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import type { DashboardPage } from './Sidebar';

interface SavingsDashboardProps {
  onNavigate: (page: DashboardPage) => void;
}

interface MemberContrib {
  id: string; full_name: string; photo_url?: string;
  total_contributed: number; last_payment: string; status: 'current' | 'behind' | 'no_payments';
}

interface MoneyRequest {
  id: string; member_name: string; member_id: string; amount: number;
  reason: string; status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  requested_at: string; notes?: string;
}

const SavingsDashboard: React.FC<SavingsDashboardProps> = ({ onNavigate }) => {
  const { user, selectedGroup, isElevated } = useAppContext();

  const [memberContribs, setMemberContribs] = useState<MemberContrib[]>([]);
  const [moneyRequests, setMoneyRequests] = useState<MoneyRequest[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [pendingContributions, setPendingContributions] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Money request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [contribResult, memberResult, requestResult] = await Promise.all([
        ds.listContributions(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
        ds.listMoneyRequests(selectedGroup.id).catch(() => ({ success: false, requests: [] })),
      ]);

      // Stats
      if (contribResult.success) {
        const contribs = contribResult.contributions || [];
        const confirmed = contribs.filter((c: any) => c.status === 'confirmed');
        const pending = contribs.filter((c: any) => c.status === 'pending');
        const totalSaved = confirmed.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const totalDueAmt = confirmed.reduce((s: number, c: any) => {
          const due = Number(c.amount_due || 0);
          if (!due && c.notes) { const m = c.notes.match(/Due: (\d+)/); return s + (m ? parseInt(m[1]) : 0); }
          return s + due;
        }, 0);
        const totalUnpaidAmt = Math.max(0, totalDueAmt - totalSaved);
        setTotalSavings(totalSaved);
        setTotalDue(totalDueAmt);
        setTotalUnpaid(totalUnpaidAmt);
        setTotalContributions(confirmed.length);
        setPendingContributions(pending.length);
      }

      // Member contributions summary
      if (memberResult.success) {
        const members = memberResult.members || [];
        setMemberCount(members.length);
        const contribs = contribResult.contributions || [];
        const memberMap: Record<string, MemberContrib> = {};
        for (const m of members) {
          memberMap[m.id] = {
            id: m.id, full_name: m.full_name, photo_url: m.photo_url,
            total_contributed: 0, last_payment: '—', status: 'no_payments',
          };
        }
        for (const c of contribs) {
          if (c.status === 'confirmed' && memberMap[c.member_id]) {
            memberMap[c.member_id].total_contributed += Number(c.amount);
            const date = c.created_at?.split('T')[0] || '';
            if (date > memberMap[c.member_id].last_payment || memberMap[c.member_id].last_payment === '—') {
              memberMap[c.member_id].last_payment = date;
            }
            memberMap[c.member_id].status = 'current';
          }
        }
        // Mark members with no confirmed contributions as 'behind' if others have contributions
        const hasAnyContributions = Object.values(memberMap).some(m => m.status === 'current');
        if (hasAnyContributions) {
          for (const m of Object.values(memberMap)) {
            if (m.status === 'no_payments') m.status = 'behind';
          }
        }
        setMemberContribs(Object.values(memberMap).sort((a, b) => b.total_contributed - a.total_contributed));

        // Collection rate
        if (members.length > 0) {
          const membersWithContribs = Object.values(memberMap).filter(m => m.status === 'current').length;
          setCollectionRate(Math.round((membersWithContribs / members.length) * 100));
        }
      }

      // Money requests
      if (requestResult.success) {
        setMoneyRequests((requestResult.requests || []).map((r: any) => ({
          id: r.id, member_name: r.member_name, member_id: r.member_id,
          amount: Number(r.amount), reason: r.reason, status: r.status,
          requested_at: r.requested_at?.split('T')[0] || '', notes: r.notes,
        })));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!requestAmount || !requestReason || !selectedGroup?.id || !user?.member_id) return;
    setIsSubmitting(true);
    try {
      await ds.submitMoneyRequest({
        group_id: selectedGroup.id,
        member_id: user.member_id,
        member_name: user.full_name,
        amount: parseInt(requestAmount),
        reason: requestReason,
      });
      showToast('Money request submitted! Awaiting approval.');
      setRequestAmount('');
      setRequestReason('');
      setShowRequestForm(false);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to submit request.', 'error');
    }
    setIsSubmitting(false);
  };

  const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      await ds.updateMoneyRequestStatus(requestId, action, user?.member_id);
      showToast(`Request ${action}!`);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const pendingRequests = moneyRequests.filter(r => r.status === 'pending');
  const recentRequests = moneyRequests.filter(r => r.status !== 'pending').slice(0, 5);

  // Theme: emerald/green for savings
  const headerGradient = 'from-emerald-600 to-teal-600';
  const accentColor = 'emerald';
  const buttonBg = 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <div className="space-y-6">
      {/* Welcome Banner — Savings theme */}
      <div className={`bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden`}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-bold">{selectedGroup?.name || 'Savings Group'}</h1>
          <p className="mt-2 text-emerald-100 max-w-lg">
            {memberCount} members • {getScheduleLabel(selectedGroup?.contribution_schedule || '')} contributions of {formatUGX(selectedGroup?.contribution_amount || 0)}
            {collectionRate > 0 && ` • ${collectionRate}% collection rate`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('contributions')} className="px-4 py-2 bg-white text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors">
              Record Contribution
            </button>
            {!isElevated && (
              <button onClick={() => setShowRequestForm(true)} className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors">
                Request Funds
              </button>
            )}
            {isElevated && pendingRequests.length > 0 && (
              <button onClick={() => document.getElementById('money-requests')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 bg-amber-400 text-amber-900 rounded-lg text-sm font-semibold hover:bg-amber-300 transition-colors">
                {pendingRequests.length} Pending Request{pendingRequests.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Stat Cards — Savings focus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Total Savings</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatUGX(totalSavings)}</p>
          <p className="text-xs text-emerald-500 font-medium mt-1">{collectionRate}% collected</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Total Due</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatUGX(totalDue)}</p>
          <p className="text-xs text-gray-400 font-medium mt-1">expected from all members</p>
        </div>
        <div className={`bg-white rounded-xl p-5 border shadow-sm ${totalUnpaid > 0 ? 'border-red-200' : 'border-gray-100'}`}>
          <p className="text-sm text-gray-500">Unpaid Balance</p>
          <p className={`text-2xl font-bold mt-1 ${totalUnpaid > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalUnpaid > 0 ? formatUGX(totalUnpaid) : '✅ All Paid'}</p>
          <p className="text-xs text-red-400 font-medium mt-1">{memberContribs.filter(m => m.status === 'behind').length} members behind</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{memberCount}</p>
          <p className="text-xs text-gray-400 font-medium mt-1">{memberContribs.filter(m => m.status === 'current').length} current</p>
        </div>
      </div>

      {/* Member Contributions Table — Accountability */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Member Contributions</h2>
            <p className="text-xs text-gray-500">Who has paid and who is behind</p>
          </div>
          <button onClick={() => onNavigate('contributions')} className="text-xs text-emerald-600 font-medium hover:underline">View All →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Member</th>
              <th className="px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right">Total Contributed</th>
              <th className="px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Last Payment</th>
              <th className="px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">Loading...</td></tr>
              ) : memberContribs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">No members yet. Add members to start tracking.</td></tr>
              ) : (
                memberContribs.map(m => (
                  <tr key={m.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={m.photo_url || IMAGES.avatars[0]} alt={m.full_name} className="w-8 h-8 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }} />
                        <span className="text-sm font-semibold text-gray-900">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-right text-gray-900">{formatUGX(m.total_contributed)}</td>
                    <td className="px-6 py-3 text-sm text-center text-gray-500">{m.last_payment}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        m.status === 'current' ? 'bg-emerald-100 text-emerald-700'
                        : m.status === 'behind' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {m.status === 'current' ? '✅ Current' : m.status === 'behind' ? '⚠️ Behind' : '— No payments'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unpaid Dues — Members Behind */}
      {memberContribs.filter(m => m.status === 'behind').length > 0 && (
        <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h2 className="text-lg font-bold text-red-800">⚠️ Unpaid Dues</h2>
            <p className="text-xs text-red-600">Members who have not made any contributions</p>
          </div>
          <div className="divide-y divide-red-50">
            {memberContribs.filter(m => m.status === 'behind').map(m => (
              <div key={m.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={m.photo_url || IMAGES.avatars[0]} alt={m.full_name} className="w-8 h-8 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }} />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{m.full_name}</p>
                    <p className="text-xs text-red-500">No payments recorded</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  {formatUGX(selectedGroup?.contribution_amount || 0)} / {getScheduleLabel(selectedGroup?.contribution_schedule || '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Money Requests Section */}
      <div id="money-requests" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Money Requests</h2>
            <p className="text-xs text-gray-500">
              {isElevated ? 'Review and approve withdrawal requests from members' : 'Submit withdrawal requests for approval'}
            </p>
          </div>
          {!isElevated && (
            <button onClick={() => setShowRequestForm(true)} className={`px-4 py-2 text-sm font-medium text-white ${buttonBg} rounded-lg transition-colors flex items-center gap-2`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Request Funds
            </button>
          )}
        </div>

        {/* Pending requests (for elevated users) */}
        {isElevated && pendingRequests.length > 0 && (
          <div className="p-4 bg-amber-50 border-b border-amber-100 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">⏳ Pending Approval ({pendingRequests.length})</p>
            {pendingRequests.map(r => (
              <div key={r.id} className="bg-white rounded-lg p-4 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{r.member_name} requests {formatUGX(r.amount)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.reason} • {r.requested_at}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRequestAction(r.id, 'approved')} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Approve</button>
                  <button onClick={() => handleRequestAction(r.id, 'rejected')} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent requests */}
        <div className="divide-y divide-gray-50">
          {recentRequests.length === 0 && !isElevated ? (
            <div className="p-8 text-center text-sm text-gray-400">No money requests yet. Use "Request Funds" to submit one.</div>
          ) : recentRequests.length === 0 && isElevated ? (
            <div className="p-8 text-center text-sm text-gray-400">No recent requests.</div>
          ) : (
            recentRequests.map(r => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.member_name} • {formatUGX(r.amount)}</p>
                  <p className="text-xs text-gray-500">{r.reason} • {r.requested_at}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                  : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {r.status === 'approved' ? '✅ Approved' : r.status === 'rejected' ? '❌ Rejected' : '💰 Disbursed'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Money Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRequestForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Request Funds</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Amount (UGX) *</label>
                <input type="number" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="50000" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Reason *</label>
                <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none resize-none" placeholder="Why do you need these funds?" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRequestForm(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSubmitRequest} disabled={isSubmitting || !requestAmount || !requestReason} className={`flex-1 py-2.5 text-sm font-bold text-white ${buttonBg} rounded-lg disabled:opacity-50`}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsDashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getScheduleLabel, getStatusColor, IMAGES } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import type { DashboardPage } from './Sidebar';

interface SavingsDashboardProps {
  onNavigate: (page: DashboardPage) => void;
}

interface MyContribution {
  id: string; amount: number; amount_due: number; status: string;
  period_label: string; payment_method: string; created_at: string;
}

interface MoneyRequest {
  id: string; member_name: string; member_id: string; amount: number;
  reason: string; status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  requested_at: string; notes?: string;
}

const SavingsDashboard: React.FC<SavingsDashboardProps> = ({ onNavigate }) => {
  const { user, selectedGroup, isElevated } = useAppContext();

  const [myContribs, setMyContribs] = useState<MyContribution[]>([]);
  const [myTotalPaid, setMyTotalPaid] = useState(0);
  const [myTotalDue, setMyTotalDue] = useState(0);
  const [moneyRequests, setMoneyRequests] = useState<MoneyRequest[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [membersBehind, setMembersBehind] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
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

      const contribs = contribResult.contributions || [];
      const confirmed = contribs.filter((c: any) => c.status === 'confirmed');

      // Group financials
      const totalSaved = confirmed.reduce((s: number, c: any) => s + Number(c.amount), 0);
      const totalDueAmt = confirmed.reduce((s: number, c: any) => {
        const due = Number(c.amount_due || 0);
        if (!due && c.notes) { const m = c.notes.match(/Due: (\d+)/); return s + (m ? parseInt(m[1]) : 0); }
        return s + due;
      }, 0);
      setTotalSavings(totalSaved);
      setTotalDue(totalDueAmt);
      setTotalUnpaid(Math.max(0, totalDueAmt - totalSaved));

      // Member stats (counts only, no names)
      const members = memberResult.members || [];
      setMemberCount(members.length);
      const memberContribMap: Record<string, number> = {};
      for (const c of confirmed) {
        memberContribMap[c.member_id] = (memberContribMap[c.member_id] || 0) + Number(c.amount);
      }
      const currentCount = Object.keys(memberContribMap).length;
      const behindCount = members.length - currentCount;
      setMembersBehind(behindCount);
      setCollectionRate(members.length > 0 ? Math.round((currentCount / members.length) * 100) : 0);

      // My personal contributions
      if (user?.member_id) {
        const mine = contribs.filter((c: any) => c.member_id === user.member_id);
        setMyContribs(mine.map((c: any) => ({
          id: c.id, amount: Number(c.amount), amount_due: Number(c.amount_due || 0),
          status: c.status, period_label: c.period_label || '',
          payment_method: c.payment_method, created_at: c.created_at?.split('T')[0] || '',
        })).sort((a: MyContribution, b: MyContribution) => b.period_label.localeCompare(a.period_label)));

        const myPaid = mine.filter((c: any) => c.status === 'confirmed').reduce((s: number, c: any) => s + Number(c.amount), 0);
        const myDue = mine.filter((c: any) => c.status === 'confirmed').reduce((s: number, c: any) => {
          const due = Number(c.amount_due || 0);
          if (!due && c.notes) { const m = c.notes.match(/Due: (\d+)/); return s + (m ? parseInt(m[1]) : 0); }
          return s + due;
        }, 0);
        setMyTotalPaid(myPaid);
        setMyTotalDue(myDue);
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
  }, [selectedGroup?.id, user?.member_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!requestAmount || !requestReason || !selectedGroup?.id || !user?.member_id) return;
    setIsSubmitting(true);
    try {
      await ds.submitMoneyRequest({
        group_id: selectedGroup.id, member_id: user.member_id,
        member_name: user.full_name, amount: parseInt(requestAmount), reason: requestReason,
      });
      showToast('Money request submitted! Awaiting approval.');
      setRequestAmount(''); setRequestReason(''); setShowRequestForm(false);
      await loadData();
    } catch (e: any) { showToast(e.message || 'Failed to submit request.', 'error'); }
    setIsSubmitting(false);
  };

  const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      await ds.updateMoneyRequestStatus(requestId, action, user?.member_id);
      showToast(`Request ${action}!`); await loadData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const pendingRequests = moneyRequests.filter(r => r.status === 'pending');
  const myRequests = moneyRequests.filter(r => r.member_id === user?.member_id && r.status !== 'pending').slice(0, 5);
  const myBalance = myTotalDue - myTotalPaid;
  const buttonBg = 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-bold">Welcome, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="mt-2 text-emerald-100 max-w-lg">
            {selectedGroup?.name} • {memberCount} members • {getScheduleLabel(selectedGroup?.contribution_schedule || '')} contributions
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!isElevated && (
              <button onClick={() => setShowRequestForm(true)} className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors">
                Request Funds
              </button>
            )}
            {isElevated && (
              <button onClick={() => onNavigate('spreadsheet')} className="px-4 py-2 bg-white text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors">
                📋 Open Spreadsheet
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

      {/* Group Financials — visible to all */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Group Financials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Total Collected</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatUGX(totalSavings)}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">{collectionRate}% collection rate</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Total Due</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatUGX(totalDue)}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">expected from all members</p>
          </div>
          <div className={`bg-white rounded-xl p-5 border shadow-sm ${totalUnpaid > 0 ? 'border-red-200' : 'border-gray-100'}`}>
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className={`text-2xl font-bold mt-1 ${totalUnpaid > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {totalUnpaid > 0 ? formatUGX(totalUnpaid) : '✅ 0'}
            </p>
            <p className="text-xs text-red-400 font-medium mt-1">{membersBehind} member{membersBehind !== 1 ? 's' : ''} behind</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{memberCount}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">{memberCount - membersBehind} current</p>
          </div>
        </div>
      </div>

      {/* My Personal Account — only your data */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">My Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">My Total Due</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatUGX(myTotalDue)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">My Total Paid</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatUGX(myTotalPaid)}</p>
          </div>
          <div className={`bg-white rounded-xl p-5 border shadow-sm ${myBalance > 0 ? 'border-red-200' : 'border-gray-100'}`}>
            <p className="text-sm text-gray-500">My Balance</p>
            <p className={`text-2xl font-bold mt-1 ${myBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {myBalance > 0 ? formatUGX(myBalance) : '✅ Clear'}
            </p>
          </div>
        </div>

        {/* My Contribution History */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">My Payment History</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          ) : myContribs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No contributions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Period</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Due</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Paid</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Balance</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {myContribs.map(c => {
                    const bal = c.amount_due - c.amount;
                    return (
                      <tr key={c.id} className="hover:bg-emerald-50/30">
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900">{c.period_label}</td>
                        <td className="px-6 py-3 text-sm text-gray-600 text-right">{c.amount_due > 0 ? formatUGX(c.amount_due) : '—'}</td>
                        <td className="px-6 py-3 text-sm font-bold text-emerald-700 text-right">{formatUGX(c.amount)}</td>
                        <td className="px-6 py-3 text-sm text-right">
                          {c.amount_due > 0 ? (
                            <span className={`font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {bal > 0 ? formatUGX(bal) : '✅'}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold capitalize ${getStatusColor(c.status)}`}>{c.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* My Money Requests */}
      {!isElevated && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">My Fund Requests</h3>
              <p className="text-xs text-gray-500">Track your withdrawal requests</p>
            </div>
            <button onClick={() => setShowRequestForm(true)} className={`px-4 py-2 text-sm font-medium text-white ${buttonBg} rounded-lg transition-colors`}>
              + New Request
            </button>
          </div>
          {myRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No requests submitted yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {myRequests.map(r => (
                <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatUGX(r.amount)}</p>
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Money Requests (Elevated: pending + recent) */}
      {isElevated && (
        <div id="money-requests" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Money Requests</h3>
            <p className="text-xs text-gray-500">Review and approve withdrawal requests</p>
          </div>
          {pendingRequests.length > 0 && (
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
          {pendingRequests.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">No pending requests.</div>
          )}
        </div>
      )}

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

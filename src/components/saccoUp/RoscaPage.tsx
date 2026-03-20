import React, { useState, useEffect } from 'react';
import { formatUGX, type RoscaDraw, type DrawStatus } from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData, type RoscaMemberAccount } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';

function cycleStatusBadge(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'active':    return 'bg-blue-100 text-blue-700';
    case 'upcoming':  return 'bg-purple-100 text-purple-700';
    default:          return 'bg-gray-100 text-gray-500';
  }
}

const RoscaPage: React.FC = () => {
  const { selectedGroupId, selectedGroup, user } = useAppContext();
  const { cycles, memberAccounts, welfareSummary, loading, userRole, canEdit, canManageWelfare, canManageCycles,
    recordMonthlyContribution, recordWelfareContribution, updateDraw, addDraw, createCycle, addWelfareExpenditure } = useRoscaData();

  const [selectedCycleNum, setSelectedCycleNum] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'welfare'>('overview');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showAddDraw, setShowAddDraw] = useState(false);
  const [showCreateCycle, setShowCreateCycle] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const active = cycles.find(c => c.status === 'active');
    if (active) setSelectedCycleNum(active.cycle_number);
    else if (cycles.length > 0) setSelectedCycleNum(cycles[cycles.length - 1].cycle_number);
  }, [cycles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <svg className="w-6 h-6 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold text-gray-500">Loading ROSCA data…</span>
      </div>
    );
  }

  if (!cycles.length) return null;

  const selectedCycle = cycles.find(c => c.cycle_number === selectedCycleNum) || cycles[cycles.length - 1];
  const isChairman = userRole === 'chairman';
  const isSecretary = userRole === 'secretary';

  if (isChairman || isSecretary) {
    const uniqueDrawNums = Array.from(new Set(selectedCycle.draws.map(d => d.draw_number))).sort((a, b) => a - b);
    const totalPaid = selectedCycle.draws.reduce((s, d) => s + d.amount_received, 0);
    const totalMembers = memberAccounts.length || 20;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">🎡 PBS Merry-Go-Round</h1>
            <p className="text-sm text-purple-500 font-semibold">{selectedCycle.cycle_name} · {totalMembers} Members · {formatUGX(selectedCycle.pot_amount_per_draw)}/winner</p>
          </div>
          <div className="flex gap-2">
            {canEdit && <button onClick={() => setShowAddDraw(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm">+ Add Draw</button>}
            {canManageCycles && <button onClick={() => setShowCreateCycle(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm">+ New Cycle</button>}
          </div>
        </div>

        {!canEdit && <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm font-semibold">View only</div>}
        {toast && <div className={`px-4 py-3 rounded-2xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{toast.msg}</div>}

        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {(['overview', 'accounts', 'welfare'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${
                activeTab === tab ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'accounts' && '👥 Member Accounts'}
              {tab === 'welfare' && '🍽️ Welfare'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Total Disbursed</p>
              <p className="text-2xl font-extrabold text-emerald-600">{formatUGX(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Members</p>
              <p className="text-2xl font-extrabold text-purple-600">{totalMembers}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Draws Completed</p>
              <p className="text-2xl font-extrabold text-blue-600">{uniqueDrawNums.length}/{selectedCycle.total_draws}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Security Deposit</p>
              <p className="text-2xl font-extrabold text-amber-600">{formatUGX(500000)}/member</p>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-gray-900">Member Accounts</h3>
              <span className="text-xs text-gray-500">{memberAccounts.length} members</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs font-extrabold text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Member</th>
                    <th className="px-4 py-3 text-center">Monthly</th>
                    <th className="px-4 py-3 text-center">Welfare</th>
                    <th className="px-4 py-3 text-right">Security</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-center">Quick Confirm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {memberAccounts.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No member accounts yet</td></tr>
                  ) : memberAccounts.map(acc => {
                    const monthlyCount = Object.values(acc.monthly_contributions || {}).filter((c: any) => c.status === 'confirmed').length;
                    const welfareCount = Object.values(acc.welfare_contributions || {}).filter((w: any) => w.status === 'confirmed').length;
                    return (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                              {acc.member_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <span className="font-bold text-gray-800">{acc.member_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${monthlyCount >= uniqueDrawNums.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {monthlyCount}/{uniqueDrawNums.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${welfareCount >= uniqueDrawNums.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {welfareCount}/{uniqueDrawNums.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600">{formatUGX(acc.security_deposit)}</td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600">{formatUGX(acc.balance)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={async () => {
                            for (const dn of uniqueDrawNums) {
                              await recordMonthlyContribution(acc.member_id, dn, 500000, 'confirmed');
                              await recordWelfareContribution(acc.member_id, dn, 50000, 'confirmed');
                            }
                            showToast(`Confirmed all for ${acc.member_name}`);
                          }} className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100 font-bold">
                            Confirm All
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'welfare' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
              <p className="text-xs font-bold text-amber-600 uppercase">Collected</p>
              <p className="text-2xl font-extrabold text-amber-700">{formatUGX(welfareSummary?.total_collected || 0)}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
              <p className="text-xs font-bold text-red-600 uppercase">Expended</p>
              <p className="text-2xl font-extrabold text-red-700">{formatUGX(welfareSummary?.total_expended || 0)}</p>
            </div>
            <div className={`rounded-2xl p-5 border ${(welfareSummary?.balance || 0) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-xs font-bold uppercase">Balance</p>
              <p className={`text-2xl font-extrabold ${(welfareSummary?.balance || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {(welfareSummary?.balance || 0) >= 0 ? '+' : ''}{formatUGX(welfareSummary?.balance || 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const myAccount = memberAccounts.find(acc => acc.member_id === user?.member_id);
  const monthlyPaid = myAccount ? Object.values(myAccount.monthly_contributions || {}).filter((c: any) => c.status === 'confirmed').length : 0;
  const welfarePaid = myAccount ? Object.values(myAccount.welfare_contributions || {}).filter((w: any) => w.status === 'confirmed').length : 0;
  const uniqueDrawNums = Array.from(new Set(selectedCycle.draws.map(d => d.draw_number))).sort((a, b) => a - b);
  const totalDraws = uniqueDrawNums.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">🎡 My PBS Account</h1>
        <p className="text-sm text-purple-500 font-semibold">{selectedCycle.cycle_name} · {selectedCycle.status}</p>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 border-2 border-purple-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-extrabold">
            {user?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{user?.full_name || 'Member'}</h2>
            <p className="text-sm text-purple-600 font-semibold">{selectedCycle.cycle_name} · {memberAccounts.length} Members</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Monthly Contributions</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold text-purple-700">{monthlyPaid}</span>
              <span className="text-sm text-gray-400 font-bold">/ {totalDraws}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${totalDraws > 0 ? (monthlyPaid / totalDraws) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">UGX 500,000 per draw</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Welfare (Food & Drinks)</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold text-amber-600">{welfarePaid}</span>
              <span className="text-sm text-gray-400 font-bold">/ {totalDraws}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${totalDraws > 0 ? (welfarePaid / totalDraws) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">UGX 50,000 per draw</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Paid</p>
            <p className="text-xl font-extrabold text-gray-800">{formatUGX(myAccount?.total_contributions || 0)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Welfare Paid</p>
            <p className="text-xl font-extrabold text-gray-800">{formatUGX(myAccount?.total_welfare || 0)}</p>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Security Deposit</p>
              <p className="text-xl font-extrabold text-amber-600">{formatUGX(myAccount?.security_deposit || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase">Balance</p>
              <p className={`text-xl font-extrabold ${(myAccount?.balance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(myAccount?.balance || 0) >= 0 ? '+' : ''}{formatUGX(myAccount?.balance || 0)}
              </p>
            </div>
          </div>
        </div>

        {myAccount?.draw_wins && myAccount.draw_wins.length > 0 && (
          <div className="mt-4 bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-600 uppercase mb-2">🏆 My Wins</p>
            {myAccount.draw_wins.map((win, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-bold text-gray-800">Draw {win.draw_number} (Slot {win.slot}) - {win.date}</span>
                <span className="font-bold text-emerald-600">{formatUGX(win.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-400">
        Chairman confirms payments on draw date. Contact your chairman for questions.
      </div>
    </div>
  );
};

export default RoscaPage;

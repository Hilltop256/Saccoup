import React, { useState, useEffect } from 'react';
import {
  MOCK_PBS_CYCLES,
  formatUGX,
  type RoscaCycle,
  type RoscaDraw,
  type DrawStatus,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import * as ds from '@/lib/dataService';

// ─── helpers ────────────────────────────────────────────────────────────────

function drawStatusBadge(status: DrawStatus) {
  switch (status) {
    case 'won': return 'bg-emerald-100 text-emerald-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'skipped': return 'bg-gray-100 text-gray-500';
    case 'forfeited': return 'bg-red-100 text-red-600';
  }
}

function cycle4StatusBadge(s?: string) {
  switch (s) {
    case 'active': return 'bg-blue-100 text-blue-700';
    case 'arrears': return 'bg-red-100 text-red-600';
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'paused': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function cycleStatusBadge(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'active': return 'bg-blue-100 text-blue-700';
    case 'upcoming': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

// blank draw template
function emptyDraw(num: number, totalMembers: number): RoscaDraw {
  return {
    draw_number: num,
    winner_name: '',
    amount_received: 750000,
    draw_date: new Date().toISOString().slice(0, 10),
    contributions_paid: totalMembers,
    total_members: totalMembers,
    status: 'won',
    notes: '',
    member_balance: 0,
    cycle4_status: 'active',
  };
}

// ─── sub-components ─────────────────────────────────────────────────────────

/** Summary bar for a single cycle */
const CycleSummaryCard: React.FC<{ cycle: RoscaCycle; onClick: () => void; isSelected: boolean }> = ({ cycle, onClick, isSelected }) => {
  const totalPaid = cycle.draws.reduce((s, d) => s + d.amount_received, 0);
  const completedDraws = cycle.draws.filter(d => d.status === 'won').length;
  const arrearsCount = cycle.draws.filter(d => d.cycle4_status === 'arrears').length;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border-2 transition-all duration-200 ${
        isSelected
          ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg shadow-purple-200/50'
          : 'border-gray-100 bg-white hover:border-purple-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cycle.cycle_number === 3 ? '🏆' : cycle.cycle_number === 2 ? '🥈' : '🥉'}</span>
          <div>
            <p className="font-extrabold text-gray-900 text-sm">{cycle.cycle_name}</p>
            <p className="text-xs text-gray-400 font-semibold">{cycle.start_date} → {cycle.end_date || 'ongoing'}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${cycleStatusBadge(cycle.status)}`}>
          {cycle.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-purple-50 rounded-xl p-2 text-center">
          <p className="text-lg font-extrabold text-purple-700">{completedDraws}/{cycle.total_draws}</p>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">Draws</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2 text-center">
          <p className="text-xs font-extrabold text-emerald-700">{formatUGX(totalPaid)}</p>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">Paid out</p>
        </div>
        <div className={`${arrearsCount > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-2 text-center`}>
          <p className={`text-lg font-extrabold ${arrearsCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{arrearsCount}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Arrears</p>
        </div>
      </div>
    </button>
  );
};

/** Row for each draw in the selected cycle */
const DrawRow: React.FC<{ draw: RoscaDraw; onEdit: (d: RoscaDraw) => void; canEdit: boolean }> = ({ draw, onEdit, canEdit }) => (
  <tr className="hover:bg-purple-50/40 transition-colors">
    <td className="px-4 py-3 text-center">
      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-extrabold mx-auto">
        D{draw.draw_number}
      </span>
    </td>
    <td className="px-4 py-3">
      <p className="text-sm font-bold text-gray-800">{draw.winner_name || '—'}</p>
      {draw.notes && <p className="text-xs text-amber-600 font-semibold">{draw.notes}</p>}
    </td>
    <td className="px-4 py-3 text-sm font-bold text-emerald-600">{formatUGX(draw.amount_received)}</td>
    <td className="px-4 py-3 text-xs text-gray-500 font-semibold">{draw.draw_date}</td>
    <td className="px-4 py-3 text-center">
      <span className="text-xs font-semibold">
        {draw.contributions_paid}/{draw.total_members}
      </span>
    </td>
    <td className="px-4 py-3">
      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${drawStatusBadge(draw.status)}`}>
        {draw.status}
      </span>
    </td>
    <td className="px-4 py-3">
      {draw.cycle4_status && (
        <div className="flex flex-col gap-0.5">
          <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${cycle4StatusBadge(draw.cycle4_status)}`}>
            C4: {draw.cycle4_status}
          </span>
          {draw.member_balance !== undefined && draw.member_balance !== 0 && (
            <span className={`text-xs font-bold ${draw.member_balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {draw.member_balance > 0 ? '+' : ''}{formatUGX(draw.member_balance)}
            </span>
          )}
        </div>
      )}
    </td>
    <td className="px-4 py-3 text-right">
      {canEdit ? (
        <button
          onClick={() => onEdit(draw)}
          className="text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
        >
          Edit
        </button>
      ) : (
        <span className="text-xs text-gray-300 font-semibold px-2.5 py-1">—</span>
      )}
    </td>
  </tr>
);

// ─── Edit Draw Modal ─────────────────────────────────────────────────────────

interface EditDrawModalProps {
  draw: RoscaDraw;
  members: { full_name: string; id: string }[];
  onSave: (d: RoscaDraw) => void;
  onClose: () => void;
  cycleNumber: number;
}

const EditDrawModal: React.FC<EditDrawModalProps> = ({ draw, members, onSave, onClose, cycleNumber }) => {
  const [form, setForm] = useState<RoscaDraw>({ ...draw });
  // Track whether the winner was typed manually vs selected from list
  const [customWinner, setCustomWinner] = useState(
    draw.winner_name !== '' && !members.find(m => m.full_name === draw.winner_name)
  );

  const set = (key: keyof RoscaDraw, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleWinnerSelect = (val: string) => {
    if (val === '__custom__') {
      setCustomWinner(true);
      set('winner_name', '');
    } else {
      setCustomWinner(false);
      set('winner_name', val);
    }
  };

  const selectValue = customWinner ? '__custom__' : form.winner_name;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-purple-200/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">
                {draw.winner_name ? `Edit Draw D${draw.draw_number}` : `Add New Draw`}
              </h2>
              <p className="text-sm text-purple-100 font-semibold">
                Cycle {cycleNumber} — Update draw details &amp; account status
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Winner */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🏅 Winner (Member)</label>
            <select
              value={selectValue}
              onChange={e => handleWinnerSelect(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white"
            >
              <option value="">— Select member —</option>
              {members.map(m => (
                <option key={m.id} value={m.full_name}>{m.full_name}</option>
              ))}
              <option value="__custom__">Other (type name)</option>
            </select>
            {customWinner && (
              <input
                type="text"
                value={form.winner_name}
                onChange={e => set('winner_name', e.target.value)}
                className="mt-2 w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
                placeholder="Enter winner name"
                autoFocus
              />
            )}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💰 Amount (UGX)</label>
              <input
                type="number"
                value={form.amount_received}
                onChange={e => set('amount_received', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📅 Draw Date</label>
              <input
                type="date"
                value={form.draw_date}
                onChange={e => set('draw_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
          </div>

          {/* Contributions Paid / Total */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">✅ Contributions Paid</label>
              <input
                type="number"
                min={0}
                max={form.total_members}
                value={form.contributions_paid}
                onChange={e => set('contributions_paid', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">👥 Total Members</label>
              <input
                type="number"
                min={1}
                value={form.total_members}
                onChange={e => set('total_members', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
          </div>

          {/* Draw status */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🎯 Draw Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white"
            >
              <option value="won">Won</option>
              <option value="pending">Pending</option>
              <option value="skipped">Skipped</option>
              <option value="forfeited">Forfeited</option>
            </select>
          </div>

          {/* Cycle 4 / next cycle section */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
            <p className="text-sm font-extrabold text-purple-700 mb-3">🔄 Next Cycle Account Status</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Status</label>
                <select
                  value={form.cycle4_status || 'active'}
                  onChange={e => set('cycle4_status', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white"
                >
                  <option value="active">Active ✅</option>
                  <option value="arrears">Arrears ⚠️</option>
                  <option value="paused">Paused ⏸</option>
                  <option value="completed">Completed 🏁</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Balance (UGX)</label>
                <input
                  type="number"
                  value={form.member_balance || 0}
                  onChange={e => set('member_balance', Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
                  placeholder="0 = even, - = arrears, + = credit"
                />
                <p className="text-[10px] text-gray-400 mt-1 font-semibold">Negative = owes group money</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">📝 Notes</label>
            <textarea
              rows={2}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none resize-none"
              placeholder="Any special notes for this draw..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.winner_name.trim()}
            className="flex-1 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-purple-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💾 Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main RoscaPage ──────────────────────────────────────────────────────────

const RoscaPage: React.FC = () => {
  const { user, selectedGroupId, selectedGroup } = useAppContext();

  // Real members loaded from the group
  const [groupMembers, setGroupMembers] = useState<{ full_name: string; id: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [cycles, setCycles] = useState<RoscaCycle[]>(MOCK_PBS_CYCLES);
  const [selectedCycleNum, setSelectedCycleNum] = useState<number>(3);
  const [editingDraw, setEditingDraw] = useState<RoscaDraw | null>(null);
  const [showAddDraw, setShowAddDraw] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Permission: admin, chairperson, or secretary can edit all cycles
  // Use the group membership role (selectedGroup.user_role) as source of truth
  const membershipRole = (selectedGroup?.user_role || '').toLowerCase();
  const canEdit = ['admin', 'chairperson', 'chairman', 'secretary'].includes(membershipRole);

  // Load real group members
  useEffect(() => {
    if (!selectedGroupId) return;
    setMembersLoading(true);
    ds.listMembers(selectedGroupId)
      .then(res => {
        if (res.success && res.members.length > 0) {
          setGroupMembers(res.members.map((m: any) => ({ full_name: m.full_name, id: m.id })));
        }
      })
      .catch(() => {/* silently fall back to empty — edit modal still works with "Other" */})
      .finally(() => setMembersLoading(false));
  }, [selectedGroupId]);

  const selectedCycle = cycles.find(c => c.cycle_number === selectedCycleNum) || cycles[cycles.length - 1];

  // Derive next-cycle summary from the latest cycle's draws
  const latestCycle = cycles[cycles.length - 1];
  const nextCycleCounts = {
    active: latestCycle?.draws.filter(d => d.cycle4_status === 'active').length || 0,
    arrears: latestCycle?.draws.filter(d => d.cycle4_status === 'arrears').length || 0,
    completed: latestCycle?.draws.filter(d => d.cycle4_status === 'completed').length || 0,
    paused: latestCycle?.draws.filter(d => d.cycle4_status === 'paused').length || 0,
  };
  const totalArrears = latestCycle?.draws.reduce((s, d) => s + (d.member_balance && d.member_balance < 0 ? Math.abs(d.member_balance) : 0), 0) || 0;

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDraw = (updated: RoscaDraw) => {
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== selectedCycleNum) return c;
      return {
        ...c,
        draws: c.draws.map(d => d.draw_number === updated.draw_number ? updated : d),
      };
    }));
    setEditingDraw(null);
    showToast(`Draw D${updated.draw_number} updated successfully!`);
  };

  const handleAddDraw = (newDraw: RoscaDraw) => {
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== selectedCycleNum) return c;
      const maxNum = Math.max(0, ...c.draws.map(d => d.draw_number));
      const drawToAdd = { ...newDraw, draw_number: maxNum + 1 };
      return { ...c, draws: [...c.draws, drawToAdd], total_draws: c.total_draws + 1 };
    }));
    setShowAddDraw(false);
    showToast('New draw added!');
  };

  const currentTotalMembers = selectedCycle?.draws[0]?.total_members || groupMembers.length || 20;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            🎡 PBS Merry-Go-Round
          </h1>
          <p className="text-sm text-purple-500 font-semibold">Cycle history, draw records &amp; account status</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddDraw(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-purple-300/40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Draw
          </button>
        )}
      </div>

      {/* Permission notice for non-editors */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm font-semibold">
          👁 View only. Contact your admin or chairman to make changes.
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-bold shadow-sm border ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Next Cycle Status Banner (derived from latest cycle) */}
      {latestCycle && (
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 rounded-3xl p-5 text-white shadow-xl shadow-purple-300/40">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔄</span>
            <div>
              <h2 className="font-extrabold text-lg">
                Cycle {latestCycle.cycle_number + 1} — Account Status Overview
              </h2>
              <p className="text-sm text-purple-200 font-semibold">
                Based on {latestCycle.cycle_name} ({latestCycle.total_draws} draws) carry-over
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold">{nextCycleCounts.active}</p>
              <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">✅ Active</p>
            </div>
            <div className="bg-red-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold">{nextCycleCounts.arrears}</p>
              <p className="text-xs font-bold text-red-200 uppercase tracking-wide">⚠️ Arrears</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold">{nextCycleCounts.completed}</p>
              <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">🏁 Settled</p>
            </div>
            <div className="bg-amber-500/20 rounded-2xl p-3 text-center">
              <p className="text-lg font-extrabold">{formatUGX(totalArrears)}</p>
              <p className="text-xs font-bold text-amber-200 uppercase tracking-wide">💸 Total Owed</p>
            </div>
          </div>
        </div>
      )}

      {/* Cycle selector */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-wider mb-3">📚 All Cycles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cycles.map(c => (
            <CycleSummaryCard
              key={c.cycle_number}
              cycle={c}
              isSelected={selectedCycleNum === c.cycle_number}
              onClick={() => setSelectedCycleNum(c.cycle_number)}
            />
          ))}
        </div>
      </div>

      {/* Selected Cycle Draw Table */}
      {selectedCycle && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">{selectedCycle.cycle_name} — Draw Records</h3>
              <p className="text-xs text-gray-500 font-semibold">
                {selectedCycle.draws.length} draws · Pot per draw: {formatUGX(selectedCycle.pot_amount_per_draw)} · {selectedCycle.start_date} → {selectedCycle.end_date || 'ongoing'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {membersLoading && (
                <span className="text-xs text-purple-400 font-semibold animate-pulse">Loading members…</span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${cycleStatusBadge(selectedCycle.status)}`}>
                {selectedCycle.status}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Draw</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Winner</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Amount</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Date</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Paid/Total</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Next Cycle</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {selectedCycle.draws.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400 font-semibold">
                      No draws recorded yet.{canEdit ? ' Click "Add Draw" to get started! 🎲' : ''}
                    </td>
                  </tr>
                ) : (
                  selectedCycle.draws.map(d => (
                    <DrawRow
                      key={d.draw_number}
                      draw={d}
                      onEdit={setEditingDraw}
                      canEdit={canEdit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Cycle totals footer */}
          {selectedCycle.draws.length > 0 && (
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-t border-purple-100 flex flex-wrap gap-4">
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Total Paid Out: </span>
                <span className="text-sm font-extrabold text-emerald-600">
                  {formatUGX(selectedCycle.draws.reduce((s, d) => s + d.amount_received, 0))}
                </span>
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Completed Draws: </span>
                <span className="text-sm font-extrabold text-purple-700">
                  {selectedCycle.draws.filter(d => d.status === 'won').length}/{selectedCycle.total_draws}
                </span>
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Arrears: </span>
                <span className="text-sm font-extrabold text-red-500">
                  {selectedCycle.draws.filter(d => d.cycle4_status === 'arrears').length} member(s)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Draw Modal */}
      {editingDraw && canEdit && (
        <EditDrawModal
          draw={editingDraw}
          members={groupMembers}
          onSave={handleSaveDraw}
          onClose={() => setEditingDraw(null)}
          cycleNumber={selectedCycleNum}
        />
      )}

      {/* Add Draw Modal */}
      {showAddDraw && canEdit && (
        <EditDrawModal
          draw={emptyDraw((selectedCycle?.draws.length || 0) + 1, currentTotalMembers)}
          members={groupMembers}
          onSave={handleAddDraw}
          onClose={() => setShowAddDraw(false)}
          cycleNumber={selectedCycleNum}
        />
      )}
    </div>
  );
};

export default RoscaPage;

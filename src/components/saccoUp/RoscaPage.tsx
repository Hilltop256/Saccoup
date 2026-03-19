import React, { useState, useEffect, useCallback } from 'react';
import {
  formatUGX,
  type RoscaDraw,
  type DrawStatus,
  type PaymentMethod,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';

type RoscaTab = 'draws' | 'payments' | 'welfare';

// ─── helpers ────────────────────────────────────────────────────────────────

function drawStatusBadge(status: DrawStatus) {
  switch (status) {
    case 'won': return 'bg-emerald-100 text-emerald-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'skipped': return 'bg-gray-100 text-gray-500';
    case 'forfeited': return 'bg-red-100 text-red-600';
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
function emptyDraw(num: number, slot: '1' | '2' = '1'): RoscaDraw {
  return {
    draw_number: num,
    winner_slot: slot,
    winner_name: '',
    amount_received: 5000000,
    draw_date: new Date().toISOString().slice(0, 10),
    savings: 0,
    paid_out: 0,
    balance: 0,
    status: 'won',
    notes: '',
  };
}

// ─── sub-components ─────────────────────────────────────────────────────────

/** Summary bar for a single cycle */
const CycleSummaryCard: React.FC<{ cycle: RoscaCycle; onClick: () => void; isSelected: boolean }> = ({ cycle, onClick, isSelected }) => {
  const totalPaid = cycle.draws.reduce((s, d) => s + d.amount_received, 0);
  const totalWinners = cycle.draws.length;

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
          <p className="text-lg font-extrabold text-purple-700">{totalWinners}</p>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">Winners</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2 text-center">
          <p className="text-xs font-extrabold text-emerald-700">{formatUGX(totalPaid)}</p>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">Total Paid</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2 text-center">
          <p className="text-lg font-extrabold text-blue-700">{formatUGX(cycle.pot_amount_per_draw)}</p>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">Per Person</p>
        </div>
      </div>
    </button>
  );
};

/** Row for each draw in the selected cycle */
const DrawRow: React.FC<{ draw: RoscaDraw; onEdit: (d: RoscaDraw) => void; canEdit: boolean }> = ({ draw, onEdit, canEdit }) => {
  return (
    <tr className="hover:bg-purple-50/40 transition-colors">
      <td className="px-4 py-3 text-center">
        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-extrabold mx-auto">
          D{draw.draw_number}-W{draw.winner_slot}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-bold text-gray-800">{draw.winner_name || '—'}</p>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-emerald-600">
        {formatUGX(draw.amount_received)}
      </td>
      <td className="px-4 py-3 text-sm font-bold text-purple-600">
        {draw.savings ? formatUGX(draw.savings) : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-bold text-blue-600">
        {draw.paid_out ? formatUGX(draw.paid_out) : '—'}
      </td>
      <td className="px-4 py-3">
        {draw.balance !== undefined && draw.balance !== 0 ? (
          <span className={`text-sm font-bold ${draw.balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {draw.balance > 0 ? '+' : ''}{formatUGX(draw.balance)}
          </span>
        ) : <span className="text-sm text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-gray-500 font-semibold max-w-[150px] truncate">{draw.notes || '—'}</p>
      </td>
      <td className="px-4 py-3 text-right">
        {canEdit ? (
          <button
            onClick={() => onEdit(draw)}
            className="text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </button>
        ) : (
          <span className="text-xs text-gray-300 font-semibold px-2.5 py-1">—</span>
        )}
      </td>
    </tr>
  );
};

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

  const winnerVal = customWinner ? '__custom__' : form.winner_name;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-purple-200/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">
                {draw.winner_name ? `Edit Draw D${draw.draw_number}-W${draw.winner_slot}` : `Add New Draw`}
              </h2>
              <p className="text-sm text-purple-100 font-semibold">
                Cycle {cycleNumber} — Winner gets {formatUGX(form.amount_received)}
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
            <label className="text-sm font-bold text-gray-700 mb-1 block">🏅 Winner</label>
            <select
              value={winnerVal}
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

          {/* Savings, Paid Out, Balance */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💎 Savings (UGX)</label>
              <input
                type="number"
                value={form.savings || 0}
                onChange={e => set('savings', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💸 Paid Out (UGX)</label>
              <input
                type="number"
                value={form.paid_out || 0}
                onChange={e => set('paid_out', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📊 Balance (UGX)</label>
              <input
                type="number"
                value={form.balance || 0}
                onChange={e => set('balance', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 font-semibold">- = owes, + = credit</p>
            </div>
          </div>

          {/* Draw status */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🎯 Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value as DrawStatus)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white"
            >
              <option value="won">Won ✅</option>
              <option value="pending">Pending ⏳</option>
              <option value="skipped">Skipped ⏭</option>
              <option value="forfeited">Forfeited ❌</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">📝 Notes</label>
            <textarea
              rows={2}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none resize-none"
              placeholder="Any notes for this draw..."
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
  const { selectedGroupId, selectedGroup } = useAppContext();
  const { cycles, loading, updateDraw, addDraw } = useRoscaData();

  // Real members loaded from the group
  const [groupMembers, setGroupMembers] = useState<{ full_name: string; id: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedCycleNum, setSelectedCycleNum] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<RoscaTab>('draws');
  const [editingDraw, setEditingDraw] = useState<RoscaDraw | null>(null);
  const [showAddDraw, setShowAddDraw] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Payment tracking state
  const [contributionStatuses, setContributionStatuses] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedDrawNum, setSelectedDrawNum] = useState<number>(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    paid_amount: '',
    payment_method: 'cash' as PaymentMethod,
    transaction_ref: '',
  });

  // Welfare expenses state
  const [welfareExpenses, setWelfareExpenses] = useState<any[]>([]);
  const [welfareLoading, setWelfareLoading] = useState(false);
  const [showWelfareModal, setShowWelfareModal] = useState(false);
  const [recordingWelfare, setRecordingWelfare] = useState(false);
  const [welfareForm, setWelfareForm] = useState({
    draw_number: 1,
    draw_date: new Date().toISOString().slice(0, 10),
    amount: '50000',
    description: 'Food and drinks for draw day',
    vendor: '',
    receipt_ref: '',
  });

  // Load contribution statuses for selected draw
  const loadPaymentData = useCallback(async () => {
    if (!selectedCycle?._db_id || !selectedGroupId) return;
    setPaymentLoading(true);
    try {
      const result = await ds.listContributionStatus(selectedCycle._db_id, selectedDrawNum);
      if (result.success) {
        setContributionStatuses(result.statuses || []);
      } else {
        setContributionStatuses([]);
      }
    } catch { setContributionStatuses([]); }
    setPaymentLoading(false);
  }, [selectedCycle?._db_id, selectedDrawNum, selectedGroupId]);

  // Load welfare expenses
  const loadWelfareData = useCallback(async () => {
    if (!selectedCycle?._db_id) return;
    setWelfareLoading(true);
    try {
      const result = await ds.listWelfareExpenses(selectedCycle._db_id);
      if (result.success) {
        setWelfareExpenses(result.expenses || []);
      }
    } catch { setWelfareExpenses([]); }
    setWelfareLoading(false);
  }, [selectedCycle?._db_id]);

  useEffect(() => {
    if (activeTab === 'payments') loadPaymentData();
  }, [activeTab, loadPaymentData]);

  useEffect(() => {
    if (activeTab === 'welfare') loadWelfareData();
  }, [activeTab, loadWelfareData]);

  // Permission: admin, chairperson, or secretary can edit all cycles
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
      .catch(() => {/* fall back gracefully */})
      .finally(() => setMembersLoading(false));
  }, [selectedGroupId]);

  // Show loading state while seeding
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <svg className="w-6 h-6 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold text-gray-500">Loading ROSCA cycle data…</span>
      </div>
    );
  }

  if (!cycles.length) return null;

  const selectedCycle = cycles.find(c => c.cycle_number === selectedCycleNum) || cycles[cycles.length - 1];

  const totalPaidOut = selectedCycle.draws.reduce((s, d) => s + d.amount_received, 0);
  const totalSavings = selectedCycle.draws.reduce((s, d) => s + (d.savings || 0), 0);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDraw = async (updated: RoscaDraw) => {
    setSaving(true);
    try {
      await updateDraw(selectedCycleNum, updated);
      setEditingDraw(null);
      showToast(`Draw D${updated.draw_number}-W${updated.winner_slot} saved!`);
    } catch {
      showToast('Failed to save draw.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDraw = async (newDraw: RoscaDraw) => {
    setSaving(true);
    try {
      await addDraw(selectedCycleNum, newDraw);
      setShowAddDraw(false);
      showToast('New draw added and saved!');
    } catch {
      showToast('Failed to add draw.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Initialize contribution status for a draw
  const handleInitDrawPayments = async () => {
    if (!selectedCycle?._db_id || !selectedGroupId) return;
    setPaymentLoading(true);
    try {
      const result = await ds.initContributionStatusForDraw({
        cycle_id: selectedCycle._db_id,
        draw_number: selectedDrawNum,
        draw_date: selectedCycle.start_date,
        members: groupMembers,
        expected_amount: 500000,
      });
      if (result.success) {
        showToast('Payment tracking initialized for Draw ' + selectedDrawNum);
        loadPaymentData();
      }
    } catch { showToast('Failed to initialize payments', 'error'); }
    setPaymentLoading(false);
  };

  // Record a payment for a member
  const handleRecordPayment = async () => {
    if (!paymentForm.member_id || !paymentForm.paid_amount || !selectedCycle?._db_id) return;
    setRecordingPayment(true);
    try {
      const member = groupMembers.find(m => m.id === paymentForm.member_id);
      const status = contributionStatuses.find(s => s.member_id === paymentForm.member_id);
      if (!status) {
        // Create new status record
        await ds.initContributionStatusForDraw({
          cycle_id: selectedCycle._db_id,
          draw_number: selectedDrawNum,
          draw_date: selectedCycle.start_date,
          members: [{ id: paymentForm.member_id, full_name: member?.full_name || '' }],
        });
      }
      const updated = await ds.listContributionStatus(selectedCycle._db_id, selectedDrawNum);
      const newStatus = updated.statuses?.find((s: any) => s.member_id === paymentForm.member_id);
      if (newStatus) {
        await ds.markContributionAsPaid({
          status_id: newStatus.id,
          paid_amount: parseInt(paymentForm.paid_amount),
          payment_method: paymentForm.payment_method,
          transaction_ref: paymentForm.transaction_ref,
        });
      }
      showToast('Payment recorded for ' + member?.full_name);
      setShowPaymentModal(false);
      setPaymentForm({ member_id: '', paid_amount: '', payment_method: 'cash', transaction_ref: '' });
      loadPaymentData();
    } catch { showToast('Failed to record payment', 'error'); }
    setRecordingPayment(false);
  };

  // Record welfare expense
  const handleRecordWelfare = async () => {
    if (!selectedCycle?._db_id) return;
    setRecordingWelfare(true);
    try {
      await ds.createWelfareExpense({
        cycle_id: selectedCycle._db_id,
        draw_number: welfareForm.draw_number,
        draw_date: welfareForm.draw_date,
        amount: parseInt(welfareForm.amount),
        description: welfareForm.description,
        vendor: welfareForm.vendor || undefined,
        receipt_ref: welfareForm.receipt_ref || undefined,
      });
      showToast('Welfare expense recorded!');
      setShowWelfareModal(false);
      loadWelfareData();
    } catch { showToast('Failed to record expense', 'error'); }
    setRecordingWelfare(false);
  };

  const totalWelfare = welfareExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const paidCount = contributionStatuses.filter(s => s.status === 'paid').length;
  const expectedCount = contributionStatuses.length || selectedCycle?.member_count || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            🎡 PBS Merry-Go-Round
          </h1>
          <p className="text-sm text-purple-500 font-semibold">Cycle history • Draw winners • 2 members win {formatUGX(5000000)} each per draw</p>
        </div>
        {canEdit && activeTab === 'draws' && (
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

      {/* Tab Navigation */}
      {selectedCycle && (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-purple-100">
            <button
              onClick={() => setActiveTab('draws')}
              className={`flex-1 py-3 text-sm font-extrabold transition-colors ${
                activeTab === 'draws'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-500 hover:bg-purple-50'
              }`}
            >
              📋 Draw Records
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 py-3 text-sm font-extrabold transition-colors ${
                activeTab === 'payments'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-500 hover:bg-purple-50'
              }`}
            >
              💰 Payments ({paidCount}/{expectedCount})
            </button>
            <button
              onClick={() => setActiveTab('welfare')}
              className={`flex-1 py-3 text-sm font-extrabold transition-colors ${
                activeTab === 'welfare'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-500 hover:bg-purple-50'
              }`}
            >
              🍱 Welfare ({formatUGX(totalWelfare)})
            </button>
          </div>
        </div>
      )}

      {/* Draws Tab */}
      {activeTab === 'draws' && selectedCycle && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">{selectedCycle.cycle_name} — Draw Records</h3>
              <p className="text-xs text-gray-500 font-semibold">
                {selectedCycle.draws.length} draws • {formatUGX(selectedCycle.pot_amount_per_draw)} per winner • {selectedCycle.start_date} → {selectedCycle.end_date || 'ongoing'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {membersLoading && (
                <span className="text-xs text-purple-400 font-semibold animate-pulse">Loading…</span>
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
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Winners (2)</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Amount Won</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Savings</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Paid Out</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Balance</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Notes</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {selectedCycle.draws.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400 font-semibold">
                      No draws recorded yet.{canEdit ? ' Click "Add Draw" to get started!' : ''}
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
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-t border-purple-100 flex flex-wrap gap-6">
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Total Paid Out: </span>
                <span className="text-sm font-extrabold text-emerald-600">{formatUGX(totalPaidOut)}</span>
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Total Savings: </span>
                <span className="text-sm font-extrabold text-purple-600">{formatUGX(totalSavings)}</span>
              </div>
              <div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Draws: </span>
                <span className="text-sm font-extrabold text-gray-700">{selectedCycle.draws.length}/{selectedCycle.total_draws}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && selectedCycle && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-50 bg-gradient-to-r from-emerald-50 to-teal-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-gray-900">💰 Payment Tracking</h3>
              <p className="text-xs text-gray-500 font-semibold">
                Track who has paid contributions for each draw
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedDrawNum}
                onChange={(e) => setSelectedDrawNum(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white"
              >
                {Array.from({ length: selectedCycle.total_draws }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Draw {d}</option>
                ))}
              </select>
              {canEdit && (
                <button
                  onClick={handleInitDrawPayments}
                  disabled={paymentLoading}
                  className="px-3 py-2 text-xs font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                >
                  Initialize Draw {selectedDrawNum}
                </button>
              )}
            </div>
          </div>

          {paymentLoading ? (
            <div className="p-12 text-center">
              <svg className="w-6 h-6 animate-spin text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : contributionStatuses.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="font-semibold">No payment data for Draw {selectedDrawNum}</p>
              <p className="text-xs mt-1">Click "Initialize Draw" to set up payment tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Member</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Expected</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Paid</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-center">Status</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Method</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contributionStatuses.map((s: any) => (
                    <tr key={s.id} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-semibold text-gray-800">{s.member_name}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUGX(s.expected_amount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatUGX(s.paid_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          s.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.payment_method || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && s.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setPaymentForm({ member_id: s.member_id, paid_amount: String(s.expected_amount), payment_method: 'cash', transaction_ref: '' });
                              setShowPaymentModal(true);
                            }}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
                          >
                            Record
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick summary */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-purple-100 flex gap-6">
            <div>
              <span className="text-xs font-extrabold text-gray-500 uppercase">Collected: </span>
              <span className="text-sm font-extrabold text-emerald-600">
                {formatUGX(contributionStatuses.reduce((s: number, c: any) => s + Number(c.paid_amount), 0))}
              </span>
            </div>
            <div>
              <span className="text-xs font-extrabold text-gray-500 uppercase">Expected: </span>
              <span className="text-sm font-extrabold text-gray-700">
                {formatUGX(contributionStatuses.reduce((s: number, c: any) => s + Number(c.expected_amount), 0))}
              </span>
            </div>
            <div>
              <span className="text-xs font-extrabold text-gray-500 uppercase">Outstanding: </span>
              <span className="text-sm font-extrabold text-red-500">
                {formatUGX(contributionStatuses.reduce((s: number, c: any) => s + Number(c.expected_amount - c.paid_amount), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Welfare Tab */}
      {activeTab === 'welfare' && selectedCycle && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-50 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">🍱 Welfare Expenses</h3>
              <p className="text-xs text-gray-500 font-semibold">
                50,000 UGX per draw for chairman's food and drinks
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setWelfareForm({ ...welfareForm, draw_number: selectedDrawNum });
                  setShowWelfareModal(true);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600"
              >
                + Add Expense
              </button>
            )}
          </div>

          {welfareLoading ? (
            <div className="p-12 text-center">
              <svg className="w-6 h-6 animate-spin text-amber-500 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : welfareExpenses.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="font-semibold">No welfare expenses recorded</p>
              <p className="text-xs mt-1">Click "Add Expense" to record draw day expenses</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-center">Draw</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Date</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Description</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Vendor</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Amount</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {welfareExpenses.map((e: any) => (
                    <tr key={e.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-center font-bold text-gray-700">D{e.draw_number}</td>
                      <td className="px-4 py-3 text-sm">{e.draw_date}</td>
                      <td className="px-4 py-3 text-sm">{e.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{e.vendor || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">{formatUGX(e.amount)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{e.receipt_ref || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total welfare */}
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-purple-100">
            <span className="text-xs font-extrabold text-gray-500 uppercase">Total Welfare Expenses: </span>
            <span className="text-sm font-extrabold text-amber-600">{formatUGX(totalWelfare)}</span>
            <span className="text-xs text-gray-400 ml-2">({welfareExpenses.length} expenses)</span>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Record Payment - Draw {selectedDrawNum}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Member *</label>
                <select
                  value={paymentForm.member_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, member_id: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">Select member</option>
                  {groupMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (UGX) *</label>
                <input
                  type="number"
                  value={paymentForm.paid_amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  placeholder="500000"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Transaction Ref</label>
                <input
                  type="text"
                  value={paymentForm.transaction_ref}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleRecordPayment} disabled={recordingPayment || !paymentForm.member_id || !paymentForm.paid_amount} className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                {recordingPayment ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welfare Modal */}
      {showWelfareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowWelfareModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Record Welfare Expense</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Draw Number *</label>
                  <select
                    value={welfareForm.draw_number}
                    onChange={(e) => setWelfareForm({ ...welfareForm, draw_number: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  >
                    {Array.from({ length: selectedCycle.total_draws }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Draw {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label>
                  <input
                    type="date"
                    value={welfareForm.draw_date}
                    onChange={(e) => setWelfareForm({ ...welfareForm, draw_date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (UGX)</label>
                <input
                  type="number"
                  value={welfareForm.amount}
                  onChange={(e) => setWelfareForm({ ...welfareForm, amount: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">Standard: 50,000 UGX per draw</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <input
                  type="text"
                  value={welfareForm.description}
                  onChange={(e) => setWelfareForm({ ...welfareForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  placeholder="Food and drinks for draw day"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Vendor (optional)</label>
                <input
                  type="text"
                  value={welfareForm.vendor}
                  onChange={(e) => setWelfareForm({ ...welfareForm, vendor: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  placeholder="Shop name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Receipt Ref (optional)</label>
                <input
                  type="text"
                  value={welfareForm.receipt_ref}
                  onChange={(e) => setWelfareForm({ ...welfareForm, receipt_ref: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
                  placeholder="Receipt number"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowWelfareModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleRecordWelfare} disabled={recordingWelfare} className="flex-1 py-2.5 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {recordingWelfare ? 'Saving...' : 'Record Expense'}
              </button>
            </div>
          </div>
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
          draw={emptyDraw((selectedCycle?.draws.length || 0) + 1)}
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

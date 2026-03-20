import React, { useState, useEffect, useCallback } from 'react';
import {
  formatUGX,
  type RoscaDraw,
  type DrawStatus,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData, type RoscaCycleWithId } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';

// ─── helpers ────────────────────────────────────────────────────────────────

function cycleStatusBadge(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'active':    return 'bg-blue-100 text-blue-700';
    case 'upcoming':  return 'bg-purple-100 text-purple-700';
    default:          return 'bg-gray-100 text-gray-500';
  }
}

function contribStatusBadge(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-emerald-100 text-emerald-700';
    case 'pending':   return 'bg-amber-100 text-amber-700';
    case 'failed':    return 'bg-red-100 text-red-600';
    default:          return 'bg-gray-100 text-gray-500';
  }
}

function emptyDraw(num: number, slot: '1' | '2' = '1'): RoscaDraw {
  return {
    draw_number:     num,
    winner_slot:     slot,
    winner_name:     '',
    amount_received: 5000000,
    draw_date:       new Date().toISOString().slice(0, 10),
    savings:         0,
    paid_out:        0,
    balance:         0,
    status:          'won',
    notes:           '',
  };
}

// ─── CycleSummaryCard ────────────────────────────────────────────────────────

const CycleSummaryCard: React.FC<{
  cycle: RoscaCycleWithId;
  onClick: () => void;
  isSelected: boolean;
}> = ({ cycle, onClick, isSelected }) => {
  const totalPaid    = cycle.draws.reduce((s, d) => s + d.amount_received, 0);
  const totalWinners = cycle.draws.length;
  const icons = ['🥉', '🥈', '🏆'];
  const icon = icons[cycle.cycle_number - 1] ?? '🎯';

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
          <span className="text-2xl">{icon}</span>
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
          <p className="text-sm font-extrabold text-blue-700">{formatUGX(cycle.pot_amount_per_draw)}</p>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">Per Winner</p>
        </div>
      </div>
    </button>
  );
};

// ─── DrawRow ─────────────────────────────────────────────────────────────────

const DrawRow: React.FC<{ draw: RoscaDraw; onEdit: (d: RoscaDraw) => void; canEdit: boolean }> = ({ draw, onEdit, canEdit }) => (
  <tr className="hover:bg-purple-50/40 transition-colors">
    <td className="px-4 py-3 text-center">
      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-extrabold mx-auto">
        D{draw.draw_number}-W{draw.winner_slot}
      </span>
    </td>
    <td className="px-4 py-3">
      <p className="text-sm font-bold text-gray-800">{draw.winner_name || '—'}</p>
      <p className="text-xs text-gray-400">{draw.draw_date}</p>
    </td>
    <td className="px-4 py-3 text-sm font-bold text-emerald-600">{formatUGX(draw.amount_received)}</td>
    <td className="px-4 py-3 text-sm font-bold text-purple-600">{draw.savings ? formatUGX(draw.savings) : '—'}</td>
    <td className="px-4 py-3 text-sm font-bold text-blue-600">{draw.paid_out ? formatUGX(draw.paid_out) : '—'}</td>
    <td className="px-4 py-3">
      {draw.balance !== undefined && draw.balance !== 0 ? (
        <span className={`text-sm font-bold ${draw.balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {draw.balance > 0 ? '+' : ''}{formatUGX(draw.balance)}
        </span>
      ) : <span className="text-sm text-gray-400">—</span>}
    </td>
    <td className="px-4 py-3">
      <p className="text-xs text-gray-500 font-semibold max-w-[140px] truncate">{draw.notes || '—'}</p>
    </td>
    <td className="px-4 py-3 text-right">
      {canEdit ? (
        <button onClick={() => onEdit(draw)}
          className="text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
          Edit
        </button>
      ) : <span className="text-xs text-gray-300 px-2.5 py-1">—</span>}
    </td>
  </tr>
);

// ─── Edit / Add Draw Modal ────────────────────────────────────────────────────

interface EditDrawModalProps {
  draw: RoscaDraw;
  members: { full_name: string; id: string }[];
  onSave: (d: RoscaDraw) => void;
  onClose: () => void;
  cycleNumber: number;
  isNew?: boolean;
}

const EditDrawModal: React.FC<EditDrawModalProps> = ({ draw, members, onSave, onClose, cycleNumber, isNew }) => {
  const [form, setForm]         = useState<RoscaDraw>({ ...draw });
  const [customWinner, setCustomWinner] = useState(
    draw.winner_name !== '' && !members.find(m => m.full_name === draw.winner_name)
  );

  const set = (key: keyof RoscaDraw, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleWinnerSelect = (val: string) => {
    if (val === '__custom__') { setCustomWinner(true); set('winner_name', ''); }
    else { setCustomWinner(false); set('winner_name', val); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-purple-200/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">
                {isNew ? 'Add New Draw' : `Edit D${draw.draw_number}-W${draw.winner_slot}`}
              </h2>
              <p className="text-sm text-purple-100 font-semibold">Cycle {cycleNumber}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isNew && (
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">🎰 Winner Slot</label>
              <select value={form.winner_slot} onChange={e => set('winner_slot', e.target.value as '1' | '2')}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white">
                <option value="1">Slot 1 (first winner)</option>
                <option value="2">Slot 2 (second winner)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🏅 Winner</label>
            <select value={customWinner ? '__custom__' : form.winner_name} onChange={e => handleWinnerSelect(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white">
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
              <option value="__custom__">Other (type name)</option>
            </select>
            {customWinner && (
              <input type="text" value={form.winner_name} onChange={e => set('winner_name', e.target.value)}
                className="mt-2 w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none"
                placeholder="Enter winner name" autoFocus />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💰 Amount (UGX)</label>
              <input type="number" value={form.amount_received} onChange={e => set('amount_received', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📅 Draw Date</label>
              <input type="date" value={form.draw_date} onChange={e => set('draw_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💎 Savings</label>
              <input type="number" value={form.savings || 0} onChange={e => set('savings', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💸 Paid Out</label>
              <input type="number" value={form.paid_out || 0} onChange={e => set('paid_out', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📊 Balance</label>
              <input type="number" value={form.balance || 0} onChange={e => set('balance', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" />
              <p className="text-[10px] text-gray-400 mt-1 font-semibold">- = owes, + = credit</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🎯 Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as DrawStatus)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white">
              <option value="won">Won ✅</option>
              <option value="pending">Pending ⏳</option>
              <option value="skipped">Skipped ⏭</option>
              <option value="forfeited">Forfeited ❌</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">📝 Notes</label>
            <textarea rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none resize-none"
              placeholder="Any notes…" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.winner_name.trim()}
            className="flex-1 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-purple-300/40 disabled:opacity-50 disabled:cursor-not-allowed">
            💾 Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Cycle Modal ───────────────────────────────────────────────────────

interface CreateCycleModalProps {
  onSave: (params: {
    cycle_name: string;
    status: 'upcoming' | 'active' | 'completed';
    start_date: string;
    end_date?: string;
    total_draws: number;
    pot_amount_per_draw: number;
    member_count: number;
    security_deposit: number;
    notes?: string;
  }) => void;
  onClose: () => void;
  nextCycleNumber: number;
}

const CreateCycleModal: React.FC<CreateCycleModalProps> = ({ onSave, onClose, nextCycleNumber }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    cycle_name:          `Cycle ${nextCycleNumber}`,
    status:              'upcoming' as 'upcoming' | 'active' | 'completed',
    start_date:          today,
    end_date:            '',
    total_draws:         10,
    pot_amount_per_draw: 5000000,
    member_count:        20,
    security_deposit:    500000,
    notes:               '',
  });

  const set = (key: string, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.cycle_name.trim() || !form.start_date) return;
    onSave({ ...form, end_date: form.end_date || undefined, notes: form.notes || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Create New Cycle</h2>
              <p className="text-sm text-emerald-100 font-semibold">Cycle {nextCycleNumber} — new ROSCA round</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">📋 Cycle Name</label>
            <input type="text" value={form.cycle_name} onChange={e => set('cycle_name', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none"
              placeholder={`Cycle ${nextCycleNumber}`} />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">🔖 Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none bg-white">
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📅 Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">📅 End Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">🎯 Total Draws</label>
              <input type="number" value={form.total_draws} min={1} onChange={e => set('total_draws', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">👥 Members</label>
              <input type="number" value={form.member_count} min={1} onChange={e => set('member_count', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">💰 Pot per Winner (UGX)</label>
              <input type="number" value={form.pot_amount_per_draw} onChange={e => set('pot_amount_per_draw', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1 block">🔒 Security Deposit (UGX)</label>
              <input type="number" value={form.security_deposit} min={0} onChange={e => set('security_deposit', Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-1 block">📝 Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none resize-none"
              placeholder="Any notes about this cycle…" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.cycle_name.trim() || !form.start_date}
            className="flex-1 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-emerald-300/40 disabled:opacity-50 disabled:cursor-not-allowed">
            🚀 Create Cycle
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Monthly Contributions Panel ──────────────────────────────────────────────

interface MonthlyPanelProps {
  cycleDbId: string;
  groupId: string;
  drawNumber: number;
  drawDate: string;
  members: { id: string; full_name: string }[];
  canEdit: boolean;
  currentUserId?: string;
}

const MonthlyContributionsPanel: React.FC<MonthlyPanelProps> = ({
  cycleDbId, groupId, drawNumber, drawDate, members, canEdit, currentUserId,
}) => {
  const [rows, setRows]       = useState<ds.RoscaMonthlyContribRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const [seeded, setSeeded]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contributions } = await ds.listRoscaMonthlyContributions(cycleDbId, drawNumber);
      setRows(contributions);
    } catch { /* ignore */ }
    setLoading(false);
  }, [cycleDbId, drawNumber]);

  useEffect(() => { load(); }, [load]);

  // Auto-seed pending rows for all members if none exist yet
  useEffect(() => {
    if (!seeded && !loading && rows.length === 0 && members.length > 0 && cycleDbId && groupId && drawDate) {
      setSeeded(true);
      ds.seedRoscaMonthlyContributions({
        cycle_id:    cycleDbId,
        group_id:    groupId,
        draw_number: drawNumber,
        draw_date:   drawDate,
        members,
      }).then(() => load()).catch(() => {});
    }
  }, [seeded, loading, rows.length, members, cycleDbId, groupId, drawNumber, drawDate, load]);

  // Reset seeded flag when draw changes
  useEffect(() => { setSeeded(false); }, [drawNumber]);

  const toggleStatus = async (row: ds.RoscaMonthlyContribRow) => {
    if (!canEdit) return;
    const next = row.status === 'confirmed' ? 'pending' : 'confirmed';
    setSaving(row.member_id);
    try {
      await ds.upsertRoscaMonthlyContribution({
        cycle_id:       cycleDbId,
        group_id:       groupId,
        draw_number:    drawNumber,
        draw_date:      drawDate,
        member_id:      row.member_id,
        member_name:    row.member_name,
        amount:         Number(row.amount),
        status:         next,
        payment_method: row.payment_method,
        recorded_by:    currentUserId,
      });
      setRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, status: next } : r));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const confirmed = rows.filter(r => r.status === 'confirmed').length;
  const total     = rows.length || members.length;
  const totalAmt  = rows.filter(r => r.status === 'confirmed').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
            📅 Monthly Contributions — Draw {drawNumber}
            <span className="text-xs font-semibold text-gray-400">({drawDate})</span>
          </h4>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">
            {confirmed}/{total} paid · {formatUGX(totalAmt)} collected
          </p>
        </div>
        <button onClick={load} className="text-xs text-blue-500 font-bold hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">↻</button>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 font-semibold">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 font-semibold">
          No members found. Add members to the group first.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(row => (
            <div key={row.member_id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
                  {row.member_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{row.member_name}</p>
                  <p className="text-xs text-gray-400">{formatUGX(Number(row.amount))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${contribStatusBadge(row.status)}`}>
                  {row.status}
                </span>
                {canEdit && (
                  <button
                    onClick={() => toggleStatus(row)}
                    disabled={saving === row.member_id}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      row.status === 'confirmed'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {saving === row.member_id ? '…' : row.status === 'confirmed' ? 'Undo' : '✓ Confirm'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3 bg-blue-50/60 border-t border-blue-100 flex flex-wrap gap-6 text-xs font-bold">
        <span className="text-emerald-700">✅ Paid: {confirmed}</span>
        <span className="text-amber-600">⏳ Pending: {total - confirmed}</span>
        <span className="text-blue-700">💰 Total: {formatUGX(totalAmt)}</span>
      </div>
    </div>
  );
};

// ─── Welfare Contributions Panel ──────────────────────────────────────────────

interface WelfarePanelProps {
  cycleDbId: string;
  groupId: string;
  drawNumber: number;
  drawDate: string;
  members: { id: string; full_name: string }[];
  canEdit: boolean;
  currentUserId?: string;
}

const WelfareContributionsPanel: React.FC<WelfarePanelProps> = ({
  cycleDbId, groupId, drawNumber, drawDate, members, canEdit, currentUserId,
}) => {
  const [rows, setRows]       = useState<ds.WelfareContribRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const [seeded, setSeeded]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contributions } = await ds.listWelfareContributions(cycleDbId, drawNumber);
      setRows(contributions);
    } catch { /* ignore */ }
    setLoading(false);
  }, [cycleDbId, drawNumber]);

  useEffect(() => { load(); }, [load]);

  // Auto-seed pending rows for all members if none exist yet
  useEffect(() => {
    if (!seeded && !loading && rows.length === 0 && members.length > 0 && cycleDbId && groupId && drawDate) {
      setSeeded(true);
      ds.seedWelfareContributions({
        cycle_id:    cycleDbId,
        group_id:    groupId,
        draw_number: drawNumber,
        draw_date:   drawDate,
        members,
      }).then(() => load()).catch(() => {});
    }
  }, [seeded, loading, rows.length, members, cycleDbId, groupId, drawNumber, drawDate, load]);

  // Reset seeded flag when draw changes
  useEffect(() => { setSeeded(false); }, [drawNumber]);

  const toggleStatus = async (row: ds.WelfareContribRow) => {
    if (!canEdit) return;
    const next = row.status === 'confirmed' ? 'pending' : 'confirmed';
    setSaving(row.member_id);
    try {
      await ds.upsertWelfareContribution({
        cycle_id:       cycleDbId,
        group_id:       groupId,
        draw_number:    drawNumber,
        draw_date:      drawDate,
        member_id:      row.member_id,
        member_name:    row.member_name,
        amount:         Number(row.amount),
        status:         next,
        payment_method: row.payment_method,
        recorded_by:    currentUserId,
      });
      setRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, status: next } : r));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const confirmed = rows.filter(r => r.status === 'confirmed').length;
  const total     = rows.length || members.length;
  const totalAmt  = rows.filter(r => r.status === 'confirmed').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
            🍽️ Welfare (Drinks & Food) — Draw {drawNumber}
            <span className="text-xs font-semibold text-gray-400">({drawDate})</span>
          </h4>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">
            UGX 50,000 per member · {confirmed}/{total} paid · {formatUGX(totalAmt)} collected · Managed by Chairman
          </p>
        </div>
        <button onClick={load} className="text-xs text-amber-600 font-bold hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors">↻</button>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 font-semibold">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 font-semibold">
          No members found. Add members to the group first.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(row => (
            <div key={row.member_id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
                  {row.member_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{row.member_name}</p>
                  <p className="text-xs text-gray-400">{formatUGX(Number(row.amount))} welfare</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${contribStatusBadge(row.status)}`}>
                  {row.status}
                </span>
                {canEdit && (
                  <button
                    onClick={() => toggleStatus(row)}
                    disabled={saving === row.member_id}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      row.status === 'confirmed'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {saving === row.member_id ? '…' : row.status === 'confirmed' ? 'Undo' : '✓ Confirm'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3 bg-amber-50/60 border-t border-amber-100 flex flex-wrap gap-6 text-xs font-bold">
        <span className="text-emerald-700">✅ Paid: {confirmed}</span>
        <span className="text-amber-600">⏳ Pending: {total - confirmed}</span>
        <span className="text-amber-700">🍽️ Total: {formatUGX(totalAmt)}</span>
      </div>
    </div>
  );
};

// ─── Main RoscaPage ──────────────────────────────────────────────────────────

const RoscaPage: React.FC = () => {
  const { selectedGroupId, selectedGroup, user } = useAppContext();
  const { cycles, loading, updateDraw, addDraw, createCycle } = useRoscaData();

  const [groupMembers, setGroupMembers]       = useState<{ full_name: string; id: string }[]>([]);
  const [membersLoading, setMembersLoading]   = useState(false);
  const [saving, setSaving]                   = useState(false);

  const [selectedCycleNum, setSelectedCycleNum] = useState<number>(3);
  const [editingDraw, setEditingDraw]           = useState<RoscaDraw | null>(null);
  const [showAddDraw, setShowAddDraw]           = useState(false);
  const [showCreateCycle, setShowCreateCycle]   = useState(false);
  const [selectedDrawNum, setSelectedDrawNum]   = useState<number | null>(null);
  const [activeTab, setActiveTab]               = useState<'draws' | 'monthly' | 'welfare'>('draws');
  const [toast, setToast]                       = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const membershipRole = (selectedGroup?.user_role || '').toLowerCase();
  const canEdit = ['admin', 'chairperson', 'chairman', 'secretary'].includes(membershipRole);

  useEffect(() => {
    if (!selectedGroupId) return;
    setMembersLoading(true);
    ds.listMembers(selectedGroupId)
      .then(res => {
        if (res.success && res.members.length > 0)
          setGroupMembers(res.members.map((m: any) => ({ full_name: m.full_name, id: m.id })));
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [selectedGroupId]);

  // Auto-select newest cycle when cycles load
  useEffect(() => {
    if (cycles.length > 0) {
      const maxNum = Math.max(...cycles.map(c => c.cycle_number));
      setSelectedCycleNum(maxNum);
    }
  }, [cycles.length]);

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

  const selectedCycle = cycles.find(c => c.cycle_number === selectedCycleNum) ?? cycles[cycles.length - 1];
  const uniqueDrawNums = Array.from(new Set(selectedCycle.draws.map(d => d.draw_number))).sort((a, b) => a - b);
  const activeDrawNum  = selectedDrawNum ?? (uniqueDrawNums[0] ?? 1);
  const activeDrawDate = selectedCycle.draws.find(d => d.draw_number === activeDrawNum)?.draw_date
    ?? new Date().toISOString().slice(0, 10);

  const totalPaidOut = selectedCycle.draws.reduce((s, d) => s + d.amount_received, 0);
  const totalSavings = selectedCycle.draws.reduce((s, d) => s + (d.savings || 0), 0);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveDraw = async (updated: RoscaDraw) => {
    setSaving(true);
    try {
      await updateDraw(selectedCycleNum, updated);
      setEditingDraw(null);
      showToast(`Draw D${updated.draw_number}-W${updated.winner_slot} saved!`);
    } catch { showToast('Failed to save draw.', 'error'); }
    finally { setSaving(false); }
  };

  const handleAddDraw = async (newDraw: RoscaDraw) => {
    setSaving(true);
    try {
      await addDraw(selectedCycleNum, newDraw);
      setShowAddDraw(false);
      showToast('New draw added!');
    } catch { showToast('Failed to add draw.', 'error'); }
    finally { setSaving(false); }
  };

  const handleCreateCycle = async (params: Parameters<typeof createCycle>[0]) => {
    setSaving(true);
    try {
      await createCycle(params);
      setShowCreateCycle(false);
      showToast('New cycle created!');
    } catch { showToast('Failed to create cycle.', 'error'); }
    finally { setSaving(false); }
  };

  const nextCycleNumber = Math.max(0, ...cycles.map(c => c.cycle_number)) + 1;
  const nextDrawNum     = uniqueDrawNums.length > 0 ? Math.max(...uniqueDrawNums) + 1 : 1;

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            🎡 PBS Merry-Go-Round
          </h1>
          <p className="text-sm text-purple-500 font-semibold">
            Cycle history · Draw winners · Monthly contributions · Welfare (UGX 50,000)
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAddDraw(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-purple-300/40">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Draw
            </button>
            <button onClick={() => setShowCreateCycle(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-emerald-300/40">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Cycle
            </button>
          </div>
        )}
      </div>

      {/* ── View-only notice ────────────────────────────────────────── */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm font-semibold">
          👁 View only. Contact your admin or chairman to make changes.
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-bold shadow-sm border ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* ── Cycle Selector ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-wider mb-3">📚 All Cycles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cycles.map(c => (
            <CycleSummaryCard
              key={c.cycle_number}
              cycle={c}
              isSelected={selectedCycleNum === c.cycle_number}
              onClick={() => {
                setSelectedCycleNum(c.cycle_number);
                setSelectedDrawNum(null);
                setActiveTab('draws');
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Selected Cycle ───────────────────────────────────────────── */}
      {selectedCycle && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          {/* Cycle header */}
          <div className="px-6 py-4 border-b border-purple-50 bg-gradient-to-r from-purple-50 to-pink-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">{selectedCycle.cycle_name}</h3>
              <p className="text-xs text-gray-500 font-semibold">
                {selectedCycle.draws.length} entries · {formatUGX(selectedCycle.pot_amount_per_draw)} per winner ·{' '}
                {selectedCycle.start_date} → {selectedCycle.end_date || 'ongoing'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {membersLoading && <span className="text-xs text-purple-400 animate-pulse font-semibold">Loading members…</span>}
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${cycleStatusBadge(selectedCycle.status)}`}>
                {selectedCycle.status}
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            {(['draws', 'monthly', 'welfare'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wide transition-colors ${
                  activeTab === tab
                    ? 'text-purple-700 border-b-2 border-purple-500 bg-purple-50/50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'draws'   && '🏆 Draw Winners'}
                {tab === 'monthly' && '📅 Monthly Contribs'}
                {tab === 'welfare' && '🍽️ Welfare (50k)'}
              </button>
            ))}
          </div>

          {/* ── Tab: Draw Winners ─────────────────────────────────── */}
          {activeTab === 'draws' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Draw</th>
                      <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Winner</th>
                      <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-left">Won</th>
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
                    ) : selectedCycle.draws.map(d => (
                      <DrawRow
                        key={`${d.draw_number}-${d.winner_slot}`}
                        draw={d}
                        onEdit={setEditingDraw}
                        canEdit={canEdit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

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
                    <span className="text-sm font-extrabold text-gray-700">{uniqueDrawNums.length}/{selectedCycle.total_draws}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Monthly / Welfare ────────────────────────────── */}
          {(activeTab === 'monthly' || activeTab === 'welfare') && (
            <div className="p-5 space-y-5">
              {/* Draw number picker */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-gray-600">Select Draw:</span>
                {uniqueDrawNums.length === 0 ? (
                  <span className="text-sm text-gray-400 italic">No draws yet — add a draw first.</span>
                ) : uniqueDrawNums.map(num => {
                  const date = selectedCycle.draws.find(d => d.draw_number === num)?.draw_date ?? '';
                  return (
                    <button key={num}
                      onClick={() => setSelectedDrawNum(num)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                        activeDrawNum === num
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                      }`}
                    >
                      D{num}{date ? ` · ${date}` : ''}
                    </button>
                  );
                })}
              </div>

              {uniqueDrawNums.length === 0 ? null : !selectedCycle._db_id || !selectedGroupId ? (
                <div className="py-8 text-center text-sm text-gray-400 font-semibold">
                  Sync your group to Supabase first to track contributions.
                </div>
              ) : (
                <>
                  {activeTab === 'monthly' && (
                    <MonthlyContributionsPanel
                      cycleDbId={selectedCycle._db_id}
                      groupId={selectedGroupId}
                      drawNumber={activeDrawNum}
                      drawDate={activeDrawDate}
                      members={groupMembers}
                      canEdit={canEdit}
                      currentUserId={user?.member_id}
                    />
                  )}
                  {activeTab === 'welfare' && (
                    <WelfareContributionsPanel
                      cycleDbId={selectedCycle._db_id}
                      groupId={selectedGroupId}
                      drawNumber={activeDrawNum}
                      drawDate={activeDrawDate}
                      members={groupMembers}
                      canEdit={canEdit}
                      currentUserId={user?.member_id}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {editingDraw && canEdit && (
        <EditDrawModal
          draw={editingDraw}
          members={groupMembers}
          onSave={handleSaveDraw}
          onClose={() => setEditingDraw(null)}
          cycleNumber={selectedCycleNum}
        />
      )}

      {showAddDraw && canEdit && (
        <EditDrawModal
          draw={emptyDraw(nextDrawNum)}
          members={groupMembers}
          onSave={handleAddDraw}
          onClose={() => setShowAddDraw(false)}
          cycleNumber={selectedCycleNum}
          isNew
        />
      )}

      {showCreateCycle && canEdit && (
        <CreateCycleModal
          onSave={handleCreateCycle}
          onClose={() => setShowCreateCycle(false)}
          nextCycleNumber={nextCycleNumber}
        />
      )}
    </div>
  );
};

export default RoscaPage;

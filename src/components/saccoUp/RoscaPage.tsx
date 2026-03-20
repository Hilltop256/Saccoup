import React, { useState, useEffect } from 'react';
import {
  formatUGX,
  type RoscaDraw,
  type DrawStatus,
  type RoscaCycle,
  IMAGES,
  MOCK_PBS_CYCLES,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData, type RoscaDrawContribution, type RoscaWelfareWithId } from '@/contexts/RoscaContext';
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
  const [editingDraw, setEditingDraw] = useState<RoscaDraw | null>(null);
  const [showAddDraw, setShowAddDraw] = useState(false);
  const [showCreateCycle, setShowCreateCycle] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  // New: Cycle creation form
  const [newCycleForm, setNewCycleForm] = useState({
    cycle_number: 4,
    cycle_name: 'Cycle 4',
    start_date: new Date().toISOString().slice(0, 10),
    total_draws: 10,
    pot_amount_per_draw: 5000000,
    member_count: 20,
    security_deposit: 500000,
    status: 'upcoming' as 'upcoming' | 'active' | 'completed',
  });
  
  // New: Tab state (Draws | Contributions | Welfare)
  const [activeTab, setActiveTab] = useState<'draws' | 'contributions' | 'welfare'>('draws');
  
  // New: Selected draw for contributions/welfare
  const [selectedDrawNum, setSelectedDrawNum] = useState<number>(1);
  
  // New: Draw contributions state
  const [drawContribs, setDrawContribs] = useState<RoscaDrawContribution[]>([]);
  const [showRecordContrib, setShowRecordContrib] = useState(false);
  const [newContrib, setNewContrib] = useState({
    member_id: '',
    amount: '',
    contribution_type: 'monthly' as 'monthly' | 'welfare',
    payment_method: 'cash',
  });
  
  // New: Welfare state
  const [welfareData, setWelfareData] = useState<RoscaWelfareWithId | null>(null);
  const [showWelfareSpend, setShowWelfareSpend] = useState(false);
  const [newSpendItem, setNewSpendItem] = useState({ item: '', cost: '' });

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

  // Load draw contributions when cycle/draw changes
  useEffect(() => {
    if (!selectedCycle?._db_id) {
      setDrawContribs([]);
      return;
    }
    ds.listRoscaDrawContributionsByCycle(selectedCycle._db_id, selectedDrawNum)
      .then(res => {
        if (res.success && res.contributions) {
          setDrawContribs(res.contributions.map((c: ds.RoscaDrawContributionRow) => ({
            _db_id: c.id,
            draw_id: c.draw_id,
            member_id: c.member_id,
            member_name: c.member_name,
            contribution_type: c.contribution_type as 'monthly' | 'welfare',
            amount: Number(c.amount),
            payment_method: c.payment_method,
            status: c.status as 'pending' | 'confirmed' | 'failed',
            transaction_ref: c.transaction_ref || undefined,
            paid_at: c.paid_at || undefined,
          })));
        }
      })
      .catch(() => setDrawContribs([]));
  }, [selectedCycle?._db_id, selectedDrawNum]);

  // Load welfare data when cycle/draw changes
  useEffect(() => {
    if (!selectedCycle?._db_id) {
      setWelfareData(null);
      return;
    }
    ds.getRoscaWelfareByDraw(selectedCycle._db_id, selectedDrawNum)
      .then(res => {
        if (res.success && res.welfare) {
          const w = res.welfare;
          setWelfareData({
            _db_id: w.id,
            cycle_id: w.cycle_id,
            draw_number: w.draw_number,
            welfare_amount: Number(w.welfare_amount),
            amount_spent: Number(w.amount_spent),
            amount_remaining: Number(w.welfare_amount) - Number(w.amount_spent),
            spent_items: (w.spent_items as any[]) || [],
            reported_by: w.reported_by,
            report_date: w.report_date,
            notes: w.notes || undefined,
          });
        } else {
          setWelfareData(null);
        }
      })
      .catch(() => setWelfareData(null));
  }, [selectedCycle?._db_id, selectedDrawNum]);

  // Ensure selectedCycleNum is valid
  useEffect(() => {
    if (cycles.length > 0 && !cycles.find(c => c.cycle_number === selectedCycleNum)) {
      setSelectedCycleNum(cycles[0].cycle_number);
    }
  }, [cycles, selectedCycleNum]);

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

  // Fallback to mock data if no cycles
  const displayCycles = cycles.length > 0 ? cycles : MOCK_PBS_CYCLES;
  const selectedCycle = displayCycles.find(c => c.cycle_number === selectedCycleNum) || displayCycles[displayCycles.length - 1];

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

  // Handle creating new cycle
  const handleCreateCycle = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    try {
      await ds.createRoscaCycle({
        group_id: selectedGroupId,
        cycle_number: newCycleForm.cycle_number,
        cycle_name: newCycleForm.cycle_name,
        status: newCycleForm.status,
        start_date: newCycleForm.start_date,
        total_draws: newCycleForm.total_draws,
        pot_amount_per_draw: newCycleForm.pot_amount_per_draw,
        member_count: newCycleForm.member_count,
        security_deposit: newCycleForm.security_deposit,
      });
      await refreshCycles();
      setShowCreateCycle(false);
      setSelectedCycleNum(newCycleForm.cycle_number);
      showToast(`Cycle ${newCycleForm.cycle_number} created successfully!`);
      // Reset form for next cycle
      setNewCycleForm(prev => ({
        ...prev,
        cycle_number: prev.cycle_number + 1,
        cycle_name: `Cycle ${prev.cycle_number + 1}`,
      }));
    } catch (e) {
      console.error('Failed to create cycle:', e);
      showToast('Failed to create cycle.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle recording draw contribution
  const handleRecordContrib = async () => {
    if (!newContrib.member_id || !newContrib.amount || !selectedCycle) return;
    
    // Check if cycle is in database
    if (!selectedCycle._db_id) {
      showToast('Please create a cycle in the database first', 'error');
      return;
    }
    
    const member = groupMembers.find(m => m.id === newContrib.member_id);
    const draw = selectedCycle.draws.find(d => d.draw_number === selectedDrawNum);
    if (!member || !draw?._db_id) {
      showToast('Please add draws to the cycle first', 'error');
      return;
    }
    
    setSaving(true);
    try {
      await ds.recordRoscaDrawContribution({
        draw_id: draw._db_id,
        member_id: newContrib.member_id,
        member_name: member.full_name,
        contribution_type: newContrib.contribution_type,
        amount: parseInt(newContrib.amount),
        payment_method: newContrib.payment_method,
        status: newContrib.payment_method === 'cash' ? 'confirmed' : 'pending',
      });
      // Reload contributions
      if (selectedCycle._db_id) {
        const res = await ds.listRoscaDrawContributionsByCycle(selectedCycle._db_id, selectedDrawNum);
        if (res.success && res.contributions) {
          setDrawContribs(res.contributions.map((c: ds.RoscaDrawContributionRow) => ({
            _db_id: c.id,
            draw_id: c.draw_id,
            member_id: c.member_id,
            member_name: c.member_name,
            contribution_type: c.contribution_type as any,
            amount: Number(c.amount),
            payment_method: c.payment_method,
            status: c.status as any,
          })));
        }
      }
      setShowRecordContrib(false);
      setNewContrib({ member_id: '', amount: '', contribution_type: 'monthly', payment_method: 'cash' });
      showToast('Contribution recorded!');
    } catch (e) {
      console.error('Failed to record contribution:', e);
      showToast('Failed to record contribution.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle welfare spending
  const handleWelfareSpend = async () => {
    if (!newSpendItem.item || !newSpendItem.cost || !selectedGroupId) return;
    
    // Check if cycle is in database
    if (!selectedCycle._db_id) {
      showToast('Please create a cycle in the database first', 'error');
      setSaving(false);
      return;
    }
    
    setSaving(true);
    try {
      // First ensure welfare record exists
      let welfareId = welfareData?._db_id;
      if (!welfareId) {
        const result = await ds.createRoscaWelfare({
          cycle_id: selectedCycle._db_id,
          draw_number: selectedDrawNum,
          welfare_amount: 50000,
        });
        if (result.welfare) {
          welfareId = result.welfare.id;
        }
      }
      
      if (!welfareId) {
        throw new Error('Failed to create welfare record');
      }
      
      // Add spending item
      const items = [...(welfareData?.spent_items || [])];
      items.push({
        item: newSpendItem.item,
        cost: parseInt(newSpendItem.cost),
        date: new Date().toISOString().split('T')[0],
        recorded_by: 'chairman',
      });
      await ds.updateRoscaWelfareSpending({
        welfare_id: welfareId,
        spent_items: items,
      });
      // Reload welfare
      if (selectedCycle?._db_id) {
        const res = await ds.getRoscaWelfareByDraw(selectedCycle._db_id, selectedDrawNum);
        if (res.success && res.welfare) {
          const w = res.welfare;
          setWelfareData({
            _db_id: w.id,
            cycle_id: w.cycle_id,
            draw_number: w.draw_number,
            welfare_amount: Number(w.welfare_amount),
            amount_spent: Number(w.amount_spent),
            amount_remaining: Number(w.welfare_amount) - Number(w.amount_spent),
            spent_items: (w.spent_items as any[]) || [],
            reported_by: w.reported_by,
            report_date: w.report_date,
          });
        }
      }
      setShowWelfareSpend(false);
      setNewSpendItem({ item: '', cost: '' });
      showToast('Welfare spending recorded!');
    } catch (e) {
      console.error('Failed to record welfare spending:', e);
      showToast('Failed to record spending.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Calculate contribution status for current draw
  const getMemberContribStatus = (memberName: string) => {
    const contrib = drawContribs.find(c => c.member_name === memberName);
    return contrib?.status || 'pending';
  };

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
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setShowCreateCycle(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Cycle
              </button>
              <button
                onClick={() => setShowAddDraw(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-purple-300/40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Draw
              </button>
            </>
          )}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {cycles.map(c => (
            <CycleSummaryCard
              key={c.cycle_number}
              cycle={c}
              isSelected={selectedCycleNum === c.cycle_number}
              onClick={() => setSelectedCycleNum(c.cycle_number)}
            />
          ))}
          {/* Add New Cycle Card */}
          {canEdit && (
            <button
              onClick={() => setShowCreateCycle(true)}
              className="border-2 border-dashed border-purple-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50/50 transition-all"
            >
              <span className="text-3xl">➕</span>
              <span className="text-sm font-bold text-purple-600">Create New Cycle</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      {selectedCycle && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('draws')}
              className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${
                activeTab === 'draws'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              📊 Draw Records
            </button>
            <button
              onClick={() => setActiveTab('contributions')}
              className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${
                activeTab === 'contributions'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              💰 Contributions
            </button>
            <button
              onClick={() => setActiveTab('welfare')}
              className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${
                activeTab === 'welfare'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              🍹 Welfare
            </button>
          </div>
        </div>
      )}

      {/* Draw Selector for Contributions & Welfare (outside tabs container) */}
      {selectedCycle && activeTab !== 'draws' && (
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700">Select Draw:</label>
          <select
            value={selectedDrawNum}
            onChange={(e) => setSelectedDrawNum(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {Array.from({ length: selectedCycle.total_draws }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Draw {n}</option>
            ))}
          </select>
          {activeTab === 'contributions' && canEdit && (
            <button
              onClick={() => setShowRecordContrib(true)}
              className="ml-auto px-3 py-2 text-sm font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
            >
              + Record Payment
            </button>
          )}
          {activeTab === 'welfare' && canEdit && (
            <button
              onClick={() => setShowWelfareSpend(true)}
              className="ml-auto px-3 py-2 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600"
            >
              + Record Spending
            </button>
          )}
        </div>
      )}

      {/* TAB CONTENT */}
      {selectedCycle && (
        <>
        {/* DRAWS TAB */}
        {activeTab === 'draws' && (
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

        {/* CONTRIBUTIONS TAB */}
        {activeTab === 'contributions' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-emerald-50 border-b border-gray-200">
              <h3 className="font-extrabold text-gray-900">💰 Draw {selectedDrawNum} - Contributions</h3>
              <p className="text-xs text-gray-500">Track who has paid for this draw</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Member</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Type</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Amount</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-left">Method</th>
                    <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-center">Status</th>
                    {canEdit && <th className="px-4 py-3 text-xs font-extrabold text-gray-500 uppercase text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                        No group members found
                      </td>
                    </tr>
                  ) : (
                    groupMembers.map(member => {
                      const contrib = drawContribs.find(c => c.member_id === member.id);
                      return (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <img src={IMAGES.avatars[0]} alt="" className="w-8 h-8 rounded-full" />
                              <span className="text-sm font-bold text-gray-900">{member.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              contrib?.contribution_type === 'welfare' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {contrib?.contribution_type === 'welfare' ? '🍹 Welfare' : '💵 Monthly'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                            {contrib ? formatUGX(contrib.amount) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {contrib?.payment_method || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                              contrib?.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                              contrib?.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              contrib?.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {contrib?.status || 'pending'}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              {contrib && contrib.status === 'pending' && (
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={async () => {
                                      if (contrib._db_id) {
                                        await ds.updateRoscaDrawContributionStatus(contrib._db_id, 'confirmed');
                                        // Reload
                                        if (selectedCycle._db_id) {
                                          const res = await ds.listRoscaDrawContributionsByCycle(selectedCycle._db_id, selectedDrawNum);
                                          if (res.success) setDrawContribs(res.contributions.map((c: ds.RoscaDrawContributionRow) => ({
                                            _db_id: c.id, draw_id: c.draw_id, member_id: c.member_id,
                                            member_name: c.member_name, contribution_type: c.contribution_type as any,
                                            amount: Number(c.amount), payment_method: c.payment_method,
                                            status: c.status as any, transaction_ref: c.transaction_ref || undefined,
                                            paid_at: c.paid_at || undefined,
                                          })));
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                    title="Confirm"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WELFARE TAB */}
        {activeTab === 'welfare' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-gray-200">
              <h3 className="font-extrabold text-gray-900">🍹 Draw {selectedDrawNum} - Welfare</h3>
              <p className="text-xs text-gray-500">50,000 UGX per draw for food & drinks</p>
            </div>
            
            {/* Welfare Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-amber-600">{formatUGX(welfareData?.welfare_amount || 50000)}</p>
                <p className="text-xs text-amber-700 font-bold">Budget</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-red-500">{formatUGX(welfareData?.amount_spent || 0)}</p>
                <p className="text-xs text-red-600 font-bold">Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-emerald-600">{formatUGX(welfareData?.amount_remaining || 50000)}</p>
                <p className="text-xs text-emerald-700 font-bold">Remaining</p>
              </div>
            </div>

            {/* Spending Items */}
            <div className="p-4">
              <h4 className="text-sm font-bold text-gray-700 mb-3">📋 Spending Details</h4>
              {welfareData?.spent_items && welfareData.spent_items.length > 0 ? (
                <div className="space-y-2">
                  {welfareData.spent_items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600">{formatUGX(item.cost)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <span className="text-4xl">🍽️</span>
                  <p className="text-sm mt-2">No spending recorded yet</p>
                  {canEdit && <p className="text-xs">Click "Record Spending" to add expenses</p>}
                </div>
              )}
            </div>
          </div>
        )}
        </>
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

      {/* Create Cycle Modal */}
      {showCreateCycle && canEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateCycle(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5 text-white">
              <h2 className="text-lg font-extrabold">🎡 Create New Cycle</h2>
              <p className="text-sm text-emerald-100">Set up Cycle {newCycleForm.cycle_number} for your group</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Cycle Number</label>
                  <input
                    type="number"
                    value={newCycleForm.cycle_number}
                    onChange={e => setNewCycleForm({...newCycleForm, cycle_number: parseInt(e.target.value), cycle_name: `Cycle ${e.target.value}`})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={newCycleForm.start_date}
                    onChange={e => setNewCycleForm({...newCycleForm, start_date: e.target.value})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Total Draws</label>
                  <input
                    type="number"
                    value={newCycleForm.total_draws}
                    onChange={e => setNewCycleForm({...newCycleForm, total_draws: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Members</label>
                  <input
                    type="number"
                    value={newCycleForm.member_count}
                    onChange={e => setNewCycleForm({...newCycleForm, member_count: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Pot Amount (UGX)</label>
                  <input
                    type="number"
                    value={newCycleForm.pot_amount_per_draw}
                    onChange={e => setNewCycleForm({...newCycleForm, pot_amount_per_draw: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">Security Deposit</label>
                  <input
                    type="number"
                    value={newCycleForm.security_deposit}
                    onChange={e => setNewCycleForm({...newCycleForm, security_deposit: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Status</label>
                <select
                  value={newCycleForm.status}
                  onChange={e => setNewCycleForm({...newCycleForm, status: e.target.value as any})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-emerald-100 rounded-xl bg-white"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowCreateCycle(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleCreateCycle} disabled={saving} className="flex-1 py-2.5 text-sm font-extrabold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Cycle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Contribution Modal */}
      {showRecordContrib && canEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRecordContrib(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5 text-white">
              <h2 className="text-lg font-extrabold">💰 Record Payment</h2>
              <p className="text-sm text-blue-100">Draw {selectedDrawNum} - {selectedCycle?.cycle_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Member *</label>
                <select
                  value={newContrib.member_id}
                  onChange={e => setNewContrib({...newContrib, member_id: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-blue-100 rounded-xl bg-white"
                >
                  <option value="">Select member</option>
                  {groupMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Type</label>
                <select
                  value={newContrib.contribution_type}
                  onChange={e => setNewContrib({...newContrib, contribution_type: e.target.value as any})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-blue-100 rounded-xl bg-white"
                >
                  <option value="monthly">💵 Monthly Contribution</option>
                  <option value="welfare">🍹 Welfare (50,000)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Amount (UGX) *</label>
                <input
                  type="number"
                  value={newContrib.amount}
                  onChange={e => setNewContrib({...newContrib, amount: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-blue-100 rounded-xl"
                  placeholder={newContrib.contribution_type === 'welfare' ? '50000' : '50000'}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Payment Method</label>
                <select
                  value={newContrib.payment_method}
                  onChange={e => setNewContrib({...newContrib, payment_method: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-blue-100 rounded-xl bg-white"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="mtn_momo">📱 MTN MoMo</option>
                  <option value="airtel_money">📱 Airtel Money</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowRecordContrib(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleRecordContrib} disabled={saving || !newContrib.member_id || !newContrib.amount} className="flex-1 py-2.5 text-sm font-extrabold text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Saving...' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welfare Spending Modal */}
      {showWelfareSpend && canEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowWelfareSpend(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
              <h2 className="text-lg font-extrabold">🍹 Record Welfare Spending</h2>
              <p className="text-sm text-amber-100">Draw {selectedDrawNum} - {selectedCycle?.cycle_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Item/Description *</label>
                <input
                  type="text"
                  value={newSpendItem.item}
                  onChange={e => setNewSpendItem({...newSpendItem, item: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-amber-100 rounded-xl"
                  placeholder="e.g., Soda, Water, Snacks"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Cost (UGX) *</label>
                <input
                  type="number"
                  value={newSpendItem.cost}
                  onChange={e => setNewSpendItem({...newSpendItem, cost: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border-2 border-amber-100 rounded-xl"
                  placeholder="e.g., 15000"
                />
              </div>
              {welfareData && (
                <div className="bg-amber-50 rounded-xl p-3 text-sm">
                  <p className="font-bold text-amber-800">Remaining Budget: {formatUGX(welfareData.amount_remaining)}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowWelfareSpend(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleWelfareSpend} disabled={saving || !newSpendItem.item || !newSpendItem.cost} className="flex-1 py-2.5 text-sm font-extrabold text-white bg-amber-500 rounded-xl hover:bg-amber-600 disabled:opacity-50">
                {saving ? 'Saving...' : 'Record Spending'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoscaPage;

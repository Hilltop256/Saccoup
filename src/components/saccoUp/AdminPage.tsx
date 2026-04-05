import React, { useState, useEffect } from 'react';
import {
  formatUGX,
  type RoscaDraw,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';

type AdminTab = 'rosca' | 'members' | 'contributions' | 'loans';

const AdminPage: React.FC = () => {
  const { selectedGroupId, selectedGroup } = useAppContext();
  const groupType = (selectedGroup?.group_type || '').toLowerCase();
  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';
  const [activeTab, setActiveTab] = useState<AdminTab>(isRoscaType ? 'rosca' : 'members');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          ⚙️ Admin Panel
        </h1>
        <p className="text-sm text-purple-500 font-semibold">Manage all group data</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-bold shadow-sm">
          ✅ {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {[
            { id: 'rosca', label: '🎡 ROSCA Draws' },
            { id: 'members', label: '👥 Members' },
            { id: 'contributions', label: '💰 Contributions' },
            { id: 'loans', label: '🏦 Loans' },
          ].filter(tab => tab.id !== 'rosca' || isRoscaType).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'rosca' && <RoscaTab onToast={showToast} />}
      {activeTab === 'members' && <MembersTab onToast={showToast} />}
      {activeTab === 'contributions' && <ContributionsTab onToast={showToast} />}
      {activeTab === 'loans' && <LoansTab onToast={showToast} />}
    </div>
  );
};

// ─── ROSCA Tab ────────────────────────────────────────────────────────────────

const RoscaTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { cycles, loading, updateDraw } = useRoscaData();
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RoscaDraw | null>(null);
  const [saving, setSaving] = useState(false);

  const currentCycle = cycles.find(c => c.cycle_number === selectedCycle) || cycles[0];

  const handleEdit = (draw: RoscaDraw) => {
    setEditingRow(`${draw.draw_number}-${draw.winner_slot}`);
    setEditForm({ ...draw });
  };

  const handleSave = async () => {
    if (!editForm || saving) return;
    setSaving(true);
    try {
      await updateDraw(selectedCycle, editForm);
      setEditingRow(null);
      setEditForm(null);
      onToast('Draw updated and saved!');
    } catch {
      onToast('Failed to save draw.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditForm(null);
  };

  const updateField = (field: keyof RoscaDraw, value: string | number) => {
    if (!editForm) return;
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3">
      <svg className="w-5 h-5 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-gray-500 font-semibold">Loading ROSCA data…</span>
    </div>
  );

  if (!cycles.length) return null;

  return (
    <div className="space-y-4">
      {/* Cycle Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700">Select Cycle:</label>
        <select
          value={selectedCycle}
          onChange={e => { setSelectedCycle(Number(e.target.value)); setEditingRow(null); setEditForm(null); }}
          className="px-4 py-2 border-2 border-purple-200 rounded-xl font-semibold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
        >
          {cycles.map(c => (
            <option key={c.cycle_number} value={c.cycle_number}>
              {c.cycle_name} ({c.draws.length} draws)
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {currentCycle.start_date} → {currentCycle.end_date || 'ongoing'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Draw</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Winner</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Savings</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Paid Out</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Deductions</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Balance</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Notes</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentCycle.draws.map(draw => (
                <tr key={`${draw.draw_number}-${draw.winner_slot}`} className="hover:bg-purple-50/50">
                  {editingRow === `${draw.draw_number}-${draw.winner_slot}` && editForm ? (
                    <>
                      <td className="px-3 py-2 font-bold text-gray-700">C{currentCycle.cycle_number}D{draw.draw_number}-W{draw.winner_slot}</td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={editForm.draw_date}
                          onChange={e => updateField('draw_date', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.winner_name}
                          onChange={e => updateField('winner_name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                          placeholder="Winner name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.amount_received}
                          onChange={e => updateField('amount_received', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.savings || 0}
                          onChange={e => updateField('savings', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.paid_out || 0}
                          onChange={e => updateField('paid_out', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.deductions || 0}
                          onChange={e => updateField('deductions', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.balance || 0}
                          onChange={e => updateField('balance', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.notes || ''}
                          onChange={e => updateField('notes', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSave} disabled={saving} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600 disabled:opacity-60">{saving ? '…' : 'Save'}</button>
                          <button onClick={handleCancel} disabled={saving} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 font-bold text-gray-700">C{currentCycle.cycle_number}D{draw.draw_number}-W{draw.winner_slot}</td>
                      <td className="px-3 py-3 text-sm text-gray-500">{draw.draw_date}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{draw.winner_name || '—'}</td>
                      <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(draw.amount_received)}</td>
                      <td className="px-3 py-3 text-sm text-purple-600 font-medium">{draw.savings ? formatUGX(draw.savings) : '—'}</td>
                      <td className="px-3 py-3 text-sm text-blue-600 font-medium">{draw.paid_out ? formatUGX(draw.paid_out) : '—'}</td>
                      <td className="px-3 py-3 text-sm text-orange-600 font-medium">{draw.deductions ? formatUGX(draw.deductions) : '—'}</td>
                      <td className="px-3 py-3 text-sm font-bold">
                        {draw.balance !== undefined && draw.balance !== 0 ? (
                          <span className={draw.balance > 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {draw.balance > 0 ? '+' : ''}{formatUGX(draw.balance)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 max-w-[150px] truncate">{draw.notes || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleEdit(draw)}
                          className="px-3 py-1 text-xs font-bold text-purple-600 bg-purple-100 rounded hover:bg-purple-200"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Members Tab ────────────────────────────────────────────────────────────────

const MembersTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { selectedGroupId, user, selectedGroup } = useAppContext();
  const { getMemberStats, cycles } = useRoscaData();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [editingDrawId, setEditingDrawId] = useState<string | null>(null);
  const [drawContributions, setDrawContributions] = useState<number[]>([]);

  const groupType = (selectedGroup?.group_type || '').toLowerCase();
  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';

  const loadMembers = () => {
    if (!selectedGroupId) return;
    setLoading(true);
    ds.listMembers(selectedGroupId)
      .then(res => {
        if (res.success) setMembers(res.members);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = (member: any) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  const handleSave = async () => {
    if (!editForm || !selectedGroupId) return;
    try {
      await ds.updateMemberRole(selectedGroupId, editForm.id, editForm.role);
      setEditingId(null);
      setEditForm(null);
      loadMembers();
      onToast('Member role updated!');
    } catch {
      onToast('Failed to update member.');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
    setEditingDrawId(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm((prev: any) => prev ? { ...prev, [field]: value } : null);
  };

  const handleEditDraws = (member: any) => {
    const memberCycles = cycles.find(c => c.cycle_number === selectedCycle);
    if (!memberCycles) return;
    
    const memberDraws = memberCycles.draws.filter(d => d.winner_name === member.full_name || d.winner_id === member.id);
    const contributions = Array(10).fill(0).map((_, i) => {
      const draw = memberDraws.find(d => d.draw_number === i + 1);
      return draw?.paid_out || 0;
    });
    setEditingDrawId(member.id);
    setDrawContributions(contributions);
  };

  const handleSaveDraws = async (memberId: string) => {
    if (!selectedGroupId || cycles.length === 0) return;
    const currentCycle = cycles.find(c => c.cycle_number === selectedCycle);
    if (!currentCycle?._db_id) return;

    for (let i = 0; i < drawContributions.length; i++) {
      const amount = drawContributions[i];
      const member = members.find(m => m.id === memberId);
      if (!member) continue;

      const existingDraws = await ds.listRoscaDraws(currentCycle._db_id);
      const existingDraw = (existingDraws.draws || []).find((d: any) => 
        d.draw_number === i + 1 && (d.winner_name === member.full_name || d.winner_id === member.id)
      );

      if (existingDraw) {
        await ds.updateRoscaDraw(existingDraw.id, {
          paid_out: amount,
          balance: amount - (existingDraw.amount_received || 0) + (existingDraw.savings || 0),
        });
      } else if (amount > 0) {
        await ds.createRoscaDraw({
          cycle_id: currentCycle._db_id,
          draw_number: i + 1,
          winner_slot: '1',
          winner_name: member.full_name,
          winner_id: member.id,
          amount_received: 0,
          paid_out: amount,
          status: 'won',
        });
      }
    }

    setEditingDrawId(null);
    onToast('Draw contributions saved!');
  };

  const updateDrawContribution = (index: number, value: number) => {
    setDrawContributions(prev => prev.map((v, i) => i === index ? value : v));
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading members...</div>;

  const currentCycle = cycles.find(c => c.cycle_number === selectedCycle);

  // Compute totals for footer
  const totals = members.reduce((acc, member) => {
    const rs = getMemberStats(member.full_name);
    return {
      sacco: acc.sacco + (member.savingsBalance || member.totalContributions || 0),
      loans: acc.loans + (member.loanBalance || 0),
      roscaWon: acc.roscaWon + rs.totalWon,
      roscaSavings: acc.roscaSavings + rs.totalSavings,
      roscaDeductions: acc.roscaDeductions + rs.totalDeductions,
    };
  }, { sacco: 0, loans: 0, roscaWon: 0, roscaSavings: 0, roscaDeductions: 0 });

  return (
    <div className="space-y-4">
      {/* Cycle Selector for ROSCA groups */}
      {isRoscaType && cycles.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <label className="text-sm font-bold text-amber-700">Cycle:</label>
          <select
            value={selectedCycle}
            onChange={e => { setSelectedCycle(Number(e.target.value)); setEditingDrawId(null); }}
            className="px-3 py-1.5 text-sm font-bold border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
          >
            {cycles.map(c => (
              <option key={c.cycle_number} value={c.cycle_number}>
                {c.cycle_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-amber-600">
            {currentCycle?.start_date} → {currentCycle?.end_date || 'ongoing'}
          </span>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-sm font-extrabold text-blue-700">{formatUGX(totals.sacco)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total SACCO Savings</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-sm font-extrabold text-emerald-700">{formatUGX(totals.roscaWon)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total ROSCA Won</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <p className="text-sm font-extrabold text-orange-700">{formatUGX(totals.loans)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Loan Balance</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
          <p className="text-sm font-extrabold text-purple-700">{formatUGX(totals.sacco + totals.roscaSavings - totals.loans)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Net Combined Position</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Name</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Role</th>
                {isRoscaType && [...Array(10)].map((_, i) => (
                  <th key={i} className="px-2 py-3 text-center text-xs font-extrabold text-amber-600 uppercase">D{i + 1}</th>
                ))}
                {isRoscaType && (
                  <>
                    <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Out. Balance</th>
                    <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Total Paid</th>
                  </>
                )}
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase hidden lg:table-cell">SACCO Savings</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase hidden lg:table-cell">Loan Balance</th>
                {isRoscaType && (
                  <>
                    <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase hidden lg:table-cell">ROSCA Won</th>
                    <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase hidden lg:table-cell">Savings</th>
                  </>
                )}
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <tr><td colSpan={isRoscaType ? 20 : 8} className="px-6 py-10 text-center text-sm text-gray-400">No members found.</td></tr>
              ) : members.map(member => {
                const rs = getMemberStats(member.full_name);
                const saccoBal = member.savingsBalance || member.totalContributions || 0;
                const loanBal = member.loanBalance || 0;
                
                const memberCycle = cycles.find(c => c.cycle_number === selectedCycle);
                const memberDraws = memberCycle?.draws.filter(d => d.winner_name === member.full_name || d.winner_id === member.id) || [];
                const totalPaid = memberDraws.reduce((s, d) => s + (d.paid_out || 0), 0);
                const totalReceived = memberDraws.reduce((s, d) => s + (d.amount_received || 0), 0);
                const outstanding = totalPaid - totalReceived;

                return (
                <tr key={member.id} className="hover:bg-purple-50/50">
                  {editingId === member.id && editForm ? (
                    <>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800">{member.full_name}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.role}
                          onChange={e => updateField('role', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="chairperson">Chairperson</option>
                          <option value="secretary">Secretary</option>
                          <option value="treasurer">Treasurer</option>
                        </select>
                      </td>
                      {isRoscaType && <td colSpan={12} className="px-3 py-2 text-sm text-gray-400">Save role first to edit draws</td>}
                      <td className="px-3 py-2 text-sm text-blue-600 hidden lg:table-cell">{formatUGX(saccoBal)}</td>
                      <td className="px-3 py-2 text-sm text-orange-600 hidden lg:table-cell">{formatUGX(loanBal)}</td>
                      {isRoscaType && (
                        <>
                          <td className="px-3 py-2 text-sm text-amber-600 hidden lg:table-cell">{rs.wins}</td>
                          <td className="px-3 py-2 text-sm text-purple-600 hidden lg:table-cell">{formatUGX(rs.totalSavings)}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSave} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : editingDrawId === member.id ? (
                    <>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800">{member.full_name}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                          member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          member.role === 'chairperson' ? 'bg-emerald-100 text-emerald-700' :
                          member.role === 'treasurer' ? 'bg-blue-100 text-blue-700' :
                          member.role === 'secretary' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      {drawContributions.map((val, i) => (
                        <td key={i} className="px-1 py-2 text-center">
                          <input
                            type="number"
                            value={val || ''}
                            onChange={e => updateDrawContribution(i, parseInt(e.target.value) || 0)}
                            className="w-14 px-1 py-1 text-xs text-center border border-amber-300 rounded focus:ring-2 focus:ring-amber-400 outline-none font-mono"
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-sm font-bold text-red-600">{formatUGX(outstanding)}</td>
                      <td className="px-2 py-2 text-sm font-bold text-emerald-600">{formatUGX(totalPaid)}</td>
                      <td className="px-3 py-2 text-sm text-blue-600 hidden lg:table-cell">{formatUGX(saccoBal)}</td>
                      <td className="px-3 py-2 text-sm text-orange-600 hidden lg:table-cell">{loanBal > 0 ? formatUGX(loanBal) : '—'}</td>
                      {isRoscaType && (
                        <>
                          <td className="px-3 py-2 text-sm text-amber-600 hidden lg:table-cell">{rs.wins > 0 ? rs.wins : '—'}</td>
                          <td className="px-3 py-2 text-sm text-purple-600 hidden lg:table-cell">{rs.totalSavings > 0 ? formatUGX(rs.totalSavings) : '—'}</td>
                        </>
                      )}
                      <td className="px-2 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleSaveDraws(member.id)} className="px-2 py-1 text-xs font-bold text-white bg-amber-500 rounded hover:bg-amber-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{member.full_name}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                          member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          member.role === 'chairperson' ? 'bg-emerald-100 text-emerald-700' :
                          member.role === 'treasurer' ? 'bg-blue-100 text-blue-700' :
                          member.role === 'secretary' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      {isRoscaType && memberDraws.slice(0, 10).map((draw, i) => (
                        <td key={i} className="px-1 py-3 text-center">
                          <span className={`text-xs font-mono ${(draw.paid_out || 0) > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
                            {(draw.paid_out || 0) > 0 ? formatUGX(draw.paid_out).replace('UGX ', '') : '—'}
                          </span>
                        </td>
                      ))}
                      {isRoscaType && (
                        <>
                          <td className={`px-3 py-3 text-sm font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {outstanding !== 0 ? formatUGX(outstanding) : '—'}
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(totalPaid)}</td>
                        </>
                      )}
                      <td className="px-3 py-3 text-sm font-medium text-blue-600 hidden lg:table-cell">{formatUGX(saccoBal)}</td>
                      <td className="px-3 py-3 text-sm text-orange-600 hidden lg:table-cell">{loanBal > 0 ? formatUGX(loanBal) : '—'}</td>
                      {isRoscaType && (
                        <>
                          <td className="px-3 py-3 text-sm font-bold text-amber-600 hidden lg:table-cell">{rs.wins > 0 ? rs.wins : '—'}</td>
                          <td className="px-3 py-3 text-sm font-bold text-purple-600 hidden lg:table-cell">{rs.totalSavings > 0 ? formatUGX(rs.totalSavings) : '—'}</td>
                        </>
                      )}
                      <td className="px-3 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {isRoscaType && (
                            <button
                              onClick={() => handleEditDraws(member)}
                              className="px-2 py-1 text-xs font-bold text-amber-600 bg-amber-100 rounded hover:bg-amber-200"
                            >
                              Draws
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(member)}
                            className="px-2 py-1 text-xs font-bold text-purple-600 bg-purple-100 rounded hover:bg-purple-200"
                          >
                            Role
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
              })}
            </tbody>
            {members.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-3 py-3 text-xs text-gray-700" colSpan={isRoscaType ? 3 : 2}>TOTALS ({members.length} members)</td>
                  {isRoscaType && <td colSpan={10}></td>}
                  {isRoscaType && (
                    <>
                      <td className="px-3 py-3 text-xs text-red-700">{
                        formatUGX(members.reduce((s, m) => {
                          const mc = cycles.find(c => c.cycle_number === selectedCycle);
                          const md = mc?.draws.filter(d => d.winner_name === m.full_name || d.winner_id === m.id) || [];
                          return s + (md.reduce((a, d) => a + (d.paid_out || 0), 0) - md.reduce((a, d) => a + (d.amount_received || 0), 0));
                        }, 0))
                      }</td>
                      <td className="px-3 py-3 text-xs text-emerald-700">{
                        formatUGX(members.reduce((s, m) => {
                          const mc = cycles.find(c => c.cycle_number === selectedCycle);
                          const md = mc?.draws.filter(d => d.winner_name === m.full_name || d.winner_id === m.id) || [];
                          return s + md.reduce((a, d) => a + (d.paid_out || 0), 0);
                        }, 0))
                      }</td>
                    </>
                  )}
                  <td className="px-3 py-3 text-xs text-blue-700 hidden lg:table-cell">{formatUGX(totals.sacco)}</td>
                  <td className="px-3 py-3 text-xs text-orange-700 hidden lg:table-cell">{formatUGX(totals.loans)}</td>
                  {isRoscaType && (
                    <>
                      <td className="px-3 py-3 text-xs text-amber-700 hidden lg:table-cell">—</td>
                      <td className="px-3 py-3 text-xs text-purple-700 hidden lg:table-cell">{formatUGX(totals.roscaSavings)}</td>
                    </>
                  )}
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Contributions Tab ──────────────────────────────────────────────────────

const ContributionsTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { selectedGroupId } = useAppContext();
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    if (!selectedGroupId) return;
    setLoading(true);
    ds.listContributions(selectedGroupId, { limit: 100 })
      .then(res => {
        if (res.success) setContributions(res.contributions);
      })
      .finally(() => setLoading(false));
  }, [selectedGroupId]);

  const handleEdit = (contrib: any) => {
    setEditingId(contrib.id);
    setEditForm({ ...contrib });
  };

  const handleSave = async () => {
    if (!editForm) return;
    try {
      await ds.updateContribution(editForm.id, {
        amount: editForm.amount,
        payment_method: editForm.payment_method,
        status: editForm.status,
      });
      // Update local state with the edited values
      setContributions(prev => prev.map(c => c.id === editForm.id ? { ...c, ...editForm, updated_at: new Date().toISOString() } : c));
      setEditingId(null);
      setEditForm(null);
      onToast('Contribution updated!');
    } catch {
      onToast('Failed to update contribution.');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm((prev: any) => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading contributions...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Member</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Method</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Period</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contributions.map(c => (
                <tr key={c.id} className="hover:bg-purple-50/50">
                  {editingId === c.id && editForm ? (
                    <>
                      <td className="px-3 py-2 text-sm">{c.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-sm">{c.member_name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={e => updateField('amount', Number(e.target.value))}
                          className="w-28 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.payment_method}
                          onChange={e => updateField('payment_method', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        >
                          <option value="mtn_momo">MTN MoMo</option>
                          <option value="airtel_money">Airtel Money</option>
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.status}
                          onChange={e => updateField('status', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-sm">{c.period_label}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSave} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-sm text-gray-600">{c.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{c.member_name}</td>
                      <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(c.amount)}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 capitalize">{c.payment_method?.replace('_', ' ')}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                          c.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500">{c.period_label || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleEdit(c)}
                          className="px-3 py-1 text-xs font-bold text-purple-600 bg-purple-100 rounded hover:bg-purple-200"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Loans Tab ────────────────────────────────────────────────────────────────

const LoansTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { selectedGroupId, user } = useAppContext();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const loadLoans = () => {
    if (!selectedGroupId) return;
    setLoading(true);
    ds.listLoans(selectedGroupId)
      .then(res => {
        if (res.success) setLoans(res.loans);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLoans(); }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = (loan: any) => {
    setEditingId(loan.id);
    setEditForm({ ...loan });
  };

  const handleSave = async () => {
    if (!editForm) return;
    try {
      await ds.updateLoanStatus(editForm.id, editForm.status, user?.member_id);
      setEditingId(null);
      setEditForm(null);
      loadLoans();
      onToast('Loan status updated!');
    } catch {
      onToast('Failed to update loan.');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm((prev: any) => prev ? { ...prev, [field]: value } : null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disbursed': case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'pending': case 'treasurer_approved': case 'approved': return 'bg-amber-100 text-amber-700';
      case 'repaying': return 'bg-blue-100 text-blue-700';
      case 'defaulted': case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading loans...</div>;

  const totalDisbursed = loans.filter(l => ['disbursed', 'repaying'].includes(l.status)).reduce((s: number, l: any) => s + Number(l.amount), 0);
  const pendingCount = loans.filter(l => ['pending', 'treasurer_approved', 'approved'].includes(l.status)).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-gray-900">{loans.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Loans</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending Approval</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xl font-extrabold text-blue-600">{loans.filter(l => l.status === 'repaying').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Being Repaid</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-sm font-extrabold text-purple-700">{formatUGX(totalDisbursed)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Outstanding</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Member</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Purpose</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Rate</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Term</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">No loans recorded yet.</td>
                </tr>
              ) : loans.map(loan => (
                <tr key={loan.id} className="hover:bg-purple-50/50">
                  {editingId === loan.id && editForm ? (
                    <>
                      <td className="px-3 py-2 text-sm text-gray-500">{loan.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800">{loan.member_name}</td>
                      <td className="px-3 py-2 text-sm font-bold text-emerald-600">{formatUGX(loan.amount)}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[150px] truncate">{loan.purpose}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{loan.interest_rate}%</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{loan.repayment_period_months}mo</td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.status}
                          onChange={e => updateField('status', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="treasurer_approved">Treasurer Approved</option>
                          <option value="approved">Approved</option>
                          <option value="disbursed">Disbursed</option>
                          <option value="repaying">Repaying</option>
                          <option value="completed">Completed</option>
                          <option value="defaulted">Defaulted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSave} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-sm text-gray-500">{loan.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{loan.member_name}</td>
                      <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(loan.amount)}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[150px] truncate">{loan.purpose || '—'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{loan.interest_rate ?? '—'}%</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{loan.repayment_period_months ?? '—'}mo</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${getStatusColor(loan.status)}`}>
                          {loan.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleEdit(loan)}
                          className="px-3 py-1 text-xs font-bold text-purple-600 bg-purple-100 rounded hover:bg-purple-200"
                        >
                          Edit Status
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

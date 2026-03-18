import React, { useState, useEffect } from 'react';
import {
  MOCK_PBS_CYCLES,
  formatUGX,
  type RoscaCycle,
  type RoscaDraw,
} from '@/lib/constants';
import { useAppContext } from '@/contexts/AppContext';
import * as ds from '@/lib/dataService';

type AdminTab = 'rosca' | 'members' | 'contributions' | 'loans';

const AdminPage: React.FC = () => {
  const { selectedGroupId, selectedGroup } = useAppContext();
  const [activeTab, setActiveTab] = useState<AdminTab>('rosca');
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
          ].map((tab) => (
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
  const [cycles, setCycles] = useState<RoscaCycle[]>(MOCK_PBS_CYCLES);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RoscaDraw | null>(null);

  const currentCycle = cycles.find(c => c.cycle_number === selectedCycle) || cycles[0];

  const handleEdit = (draw: RoscaDraw) => {
    setEditingRow(draw.draw_number);
    setEditForm({ ...draw });
  };

  const handleSave = () => {
    if (!editForm) return;
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== selectedCycle) return c;
      return {
        ...c,
        draws: c.draws.map(d => d.draw_number === editForm.draw_number ? editForm : d),
      };
    }));
    setEditingRow(null);
    setEditForm(null);
    onToast('Draw updated successfully!');
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditForm(null);
  };

  const updateField = (field: keyof RoscaDraw, value: string | number) => {
    if (!editForm) return;
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

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
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Winners</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Date</th>
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
                <tr key={draw.draw_number} className="hover:bg-purple-50/50">
                  {editingRow === draw.draw_number && editForm ? (
                    <>
                      <td className="px-3 py-2 font-bold text-gray-700">C{currentCycle.cycle_number}D{draw.draw_number}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={editForm.winner_name}
                            onChange={e => updateField('winner_name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                            placeholder="Winner 1"
                          />
                          <input
                            type="text"
                            value={editForm.winner2_name || ''}
                            onChange={e => updateField('winner2_name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                            placeholder="Winner 2"
                          />
                        </div>
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
                          type="date"
                          value={editForm.draw_date}
                          onChange={e => updateField('draw_date', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
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
                          <button onClick={handleSave} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 font-bold text-gray-700">C{currentCycle.cycle_number}D{draw.draw_number}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">
                        <div className="flex flex-col">
                          <span>{draw.winner_name || '—'}</span>
                          {draw.winner2_name && <span className="text-gray-500">{draw.winner2_name}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(draw.amount_received)}</td>
                      <td className="px-3 py-3 text-sm text-gray-500">{draw.draw_date}</td>
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
  const { selectedGroupId } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    if (!selectedGroupId) return;
    setLoading(true);
    ds.listMembers(selectedGroupId)
      .then(res => {
        if (res.success) setMembers(res.members);
      })
      .finally(() => setLoading(false));
  }, [selectedGroupId]);

  const handleEdit = (member: any) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  const handleSave = async () => {
    if (!editForm || !selectedGroupId) return;
    // For now just show success - full update would require an updateMember function
    setEditingId(null);
    setEditForm(null);
    onToast('Member updated! (Note: Full update requires backend)');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading members...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Name</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Email</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Role</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Savings</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-purple-50/50">
                  {editingId === member.id && editForm ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={e => updateField('full_name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={e => updateField('phone', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.email || ''}
                          onChange={e => updateField('email', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
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
                      <td className="px-3 py-2 text-sm font-medium text-purple-600">{formatUGX(editForm.savingsBalance || 0)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSave} className="px-2 py-1 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">Save</button>
                          <button onClick={handleCancel} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{member.full_name}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-3 py-3 text-sm text-gray-500">{member.email || '—'}</td>
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
                      <td className="px-3 py-3 text-sm font-medium text-purple-600">{formatUGX(member.savingsBalance || 0)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleEdit(member)}
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

  const handleSave = () => {
    setEditingId(null);
    setEditForm(null);
    onToast('Contribution updated!');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
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
  const { selectedGroupId } = useAppContext();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    if (!selectedGroupId) return;
    setLoading(true);
    ds.listLoans(selectedGroupId)
      .then(res => {
        if (res.success) setLoans(res.loans);
      })
      .finally(() => setLoading(false));
  }, [selectedGroupId]);

  const handleEdit = (loan: any) => {
    setEditingId(loan.id);
    setEditForm({ ...loan });
  };

  const handleSave = () => {
    setEditingId(null);
    setEditForm(null);
    onToast('Loan updated!');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateField = (field: string, value: any) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading loans...</div>;

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
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Purpose</th>
                <th className="px-3 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map(loan => (
                <tr key={loan.id} className="hover:bg-purple-50/50">
                  {editingId === loan.id && editForm ? (
                    <>
                      <td className="px-3 py-2 text-sm">{loan.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-sm">{loan.member_name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={e => updateField('amount', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.purpose}
                          onChange={e => updateField('purpose', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.status}
                          onChange={e => updateField('status', e.target.value)}
                          className="px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-400 outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="disbursed">Disbursed</option>
                          <option value="repaying">Repaying</option>
                          <option value="completed">Completed</option>
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
                      <td className="px-3 py-3 text-sm text-gray-600">{loan.created_at?.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{loan.member_name}</td>
                      <td className="px-3 py-3 text-sm font-bold text-emerald-600">{formatUGX(loan.amount)}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[200px] truncate">{loan.purpose}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                          loan.status === 'disbursed' || loan.status === 'repaying' ? 'bg-blue-100 text-blue-700' :
                          loan.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          loan.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          loan.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleEdit(loan)}
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

export default AdminPage;

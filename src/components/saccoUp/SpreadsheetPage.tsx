import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getScheduleLabel } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import { supabase } from '@/lib/supabase';

type SpreadsheetTab = 'contributions' | 'expenses' | 'financials' | 'rosca';

interface MemberRow {
  member_id: string; full_name: string; phone: string;
  due: number; paid: number; saved: boolean;
}

interface ExpenseRow {
  id: string; description: string; amount: number;
  category: string; period_label: string; notes?: string;
}

interface RoscaMemberRow {
  member_id: string;
  full_name: string;
  phone: string;
  drawContributions: number[];
  amountReceived: number;
  securitySavings: number;
  balance: number;
  saved: boolean;
}

const SpreadsheetPage: React.FC = () => {
  const { user, selectedGroup, isChairman, isTreasurer } = useAppContext();
  const [activeTab, setActiveTab] = useState<SpreadsheetTab>('contributions');
  const [period, setPeriod] = useState('2025');
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Financial summary
  const [bankBalance, setBankBalance] = useState('');
  const [investments, setInvestments] = useState('');
  const [financialNotes, setFinancialNotes] = useState('');
  const [savingFinancials, setSavingFinancials] = useState(false);

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'general', notes: '' });

  // ROSCA data
  const [roscaCycles, setRoscaCycles] = useState<any[]>([]);
  const [selectedRoscaCycle, setSelectedRoscaCycle] = useState<number>(1);
  const [roscaRows, setRoscaRows] = useState<RoscaMemberRow[]>([]);
  const [roscaLoading, setRoscaLoading] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const periods = ['2024', '2025', '2026', '2027'];

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [memberResult, contribResult, expenseResult, financialResult] = await Promise.all([
        ds.listMembers(selectedGroup.id),
        ds.listContributions(selectedGroup.id),
        ds.listExpenses(selectedGroup.id, period).catch(() => ({ success: false, expenses: [] })),
        ds.getGroupFinancials(selectedGroup.id, period).catch(() => ({ success: false, financials: null })),
      ]);

      // Members
      const members = (memberResult.members || []).map((m: any) => ({
        member_id: m.id, full_name: m.full_name, phone: m.phone || '',
        due: 0, paid: 0, saved: false,
      }));
      const contribs = (contribResult.contributions || []).filter((c: any) => {
        const cp = c.period_label || '';
        return cp === period || cp.includes(period);
      });
      for (const c of contribs) {
        const row = members.find((m: MemberRow) => m.member_id === c.member_id);
        if (row) {
          const due = Number(c.amount_due || 0);
          if (due > 0) row.due = due;
          row.paid += Number(c.amount);
        }
      }
      setRows(members.sort((a: MemberRow, b: MemberRow) => a.full_name.localeCompare(b.full_name)));

      // Expenses
      if (expenseResult.success) {
        setExpenses((expenseResult.expenses || []).map((e: any) => ({
          id: e.id, description: e.description, amount: Number(e.amount),
          category: e.category, period_label: e.period_label, notes: e.notes,
        })));
      }

      // Financials
      if (financialResult.success && financialResult.financials) {
        const f = financialResult.financials;
        setBankBalance(String(f.bank_balance || ''));
        setInvestments(String(f.investments || ''));
        setFinancialNotes(f.notes || '');
      } else {
        setBankBalance(''); setInvestments(''); setFinancialNotes('');
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id, period]);

  // --- ROSCA Data Loading ---
  const loadRoscaData = useCallback(async () => {
    if (!selectedGroup?.id) return;
    setRoscaLoading(true);
    try {
      const cyclesResult = await ds.listRoscaCycles(selectedGroup.id);
      if (cyclesResult.success && cyclesResult.cycles.length > 0) {
        setRoscaCycles(cyclesResult.cycles);
        const currentCycle = cyclesResult.cycles.find((c: any) => c.cycle_number === selectedRoscaCycle) || cyclesResult.cycles[0];
        
        const drawsResult = await ds.listRoscaDraws(currentCycle.id);
        const draws = drawsResult.success ? drawsResult.draws : [];
        
        const memberResult = await ds.listMembers(selectedGroup.id);
        const members = memberResult.success ? memberResult.members : [];
        
        const roscaMemberRows: RoscaMemberRow[] = (members || []).map((m: any) => {
          const memberDraws = draws.filter((d: any) => d.winner_name === m.full_name || d.winner_id === m.id);
          const amountReceived = memberDraws.reduce((sum: number, d: any) => sum + Number(d.amount_received || 0), 0);
          const securitySavings = memberDraws.reduce((sum: number, d: any) => sum + Number(d.savings || 0), 0);
          const totalContributions = memberDraws.reduce((sum: number, d: any) => sum + Number(d.paid_out || 0), 0);
          
          return {
            member_id: m.id,
            full_name: m.full_name,
            phone: m.phone || '',
            drawContributions: Array(10).fill(0),
            amountReceived,
            securitySavings,
            balance: totalContributions - amountReceived + securitySavings,
            saved: true,
          };
        });
        
        setRoscaRows(roscaMemberRows.sort((a: RoscaMemberRow, b: RoscaMemberRow) => a.full_name.localeCompare(b.full_name)));
      } else {
        setRoscaCycles([]);
        setRoscaRows([]);
      }
    } catch (e) { console.error(e); }
    setRoscaLoading(false);
  }, [selectedGroup?.id, selectedRoscaCycle]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadRoscaData(); }, [loadRoscaData]);

  // --- Contributions ---
  const updateRow = (memberId: string, field: 'due' | 'paid', value: number) => {
    setRows(prev => prev.map(r => r.member_id === memberId ? { ...r, [field]: value, saved: false } : r));
  };

  const saveRow = async (row: MemberRow) => {
    if (!selectedGroup?.id) return;
    setSaving(row.member_id);
    try {
      const { data: existing } = await supabase.from('contributions')
        .select('id').eq('group_id', selectedGroup.id)
        .eq('member_id', row.member_id).eq('period_label', period).maybeSingle();
      if (existing) {
        await supabase.from('contributions').update({
          amount: row.paid, amount_due: row.due, updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('contributions').insert({
          group_id: selectedGroup.id, member_id: row.member_id, member_name: row.full_name,
          amount: row.paid, amount_due: row.due, payment_method: 'bank_transfer',
          status: row.paid > 0 ? 'confirmed' : 'pending', period_label: period,
          notes: `Due: ${row.due}, Paid: ${row.paid}, Balance: ${row.due - row.paid}`,
        });
      }
      setRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, saved: true } : r));
      showToast(`${row.full_name} saved!`);
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    setSaving(null);
  };

  // --- Expenses ---
  const handleAddExpense = async () => {
    if (!selectedGroup?.id || !newExpense.description || !newExpense.amount) return;
    try {
      await ds.addExpense({
        group_id: selectedGroup.id, description: newExpense.description,
        amount: parseInt(newExpense.amount), category: newExpense.category,
        period_label: period, recorded_by: user?.full_name, notes: newExpense.notes,
      });
      showToast('Expense added!');
      setNewExpense({ description: '', amount: '', category: 'general', notes: '' });
      setShowExpenseForm(false);
      await loadData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await ds.deleteExpense(id);
      showToast('Expense deleted!');
      await loadData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  // --- Financials ---
  const handleSaveFinancials = async () => {
    if (!selectedGroup?.id) return;
    setSavingFinancials(true);
    try {
      await ds.upsertGroupFinancials({
        group_id: selectedGroup.id, period_label: period,
        bank_balance: parseInt(bankBalance) || 0,
        investments: parseInt(investments) || 0,
        total_expenses: totalExpenses,
        notes: financialNotes, recorded_by: user?.full_name,
      });
      showToast('Financial summary saved!');
    } catch (e: any) { showToast(e.message, 'error'); }
    setSavingFinancials(false);
  };

  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalBalance = totalDue - totalPaid;
  const membersBehind = rows.filter(r => r.due > 0 && r.paid < r.due).length;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // --- ROSCA Save Function ---
  const saveRoscaRow = async (row: RoscaMemberRow) => {
    if (!selectedGroup?.id || roscaCycles.length === 0) return;
    setSaving(row.member_id);
    try {
      const currentCycle = roscaCycles.find((c: any) => c.cycle_number === selectedRoscaCycle) || roscaCycles[0];
      
      for (let drawIdx = 0; drawIdx < row.drawContributions.length; drawIdx++) {
        const amount = row.drawContributions[drawIdx];
        if (amount > 0) {
          const existingDraws = await ds.listRoscaDraws(currentCycle.id);
          const existingDraw = (existingDraws.draws || []).find((d: any) => 
            d.draw_number === drawIdx + 1 && (d.winner_name === row.full_name || d.winner_id === row.member_id)
          );
          
          if (existingDraw) {
            await ds.updateRoscaDraw(existingDraw.id, {
              paid_out: amount,
              balance: amount - (existingDraw.amount_received || 0) + (existingDraw.savings || 0),
            });
          } else {
            await ds.createRoscaDraw({
              cycle_id: currentCycle.id,
              draw_number: drawIdx + 1,
              winner_slot: '1',
              winner_name: row.full_name,
              winner_id: row.member_id,
              amount_received: 0,
              paid_out: amount,
              status: 'won',
            });
          }
        }
      }
      
      setRoscaRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, saved: true } : r));
      showToast(`${row.full_name} ROSCA contributions saved!`);
      await loadRoscaData();
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    setSaving(null);
  };

  if (!isChairman && !isTreasurer) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Restricted Access</h3>
        <p className="text-sm text-gray-500">Only the Chairman and Treasurer can edit financial records.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'contributions' as SpreadsheetTab, label: '💰 Contributions', count: rows.length },
    { id: 'expenses' as SpreadsheetTab, label: '📊 Expenses', count: expenses.length },
    { id: 'financials' as SpreadsheetTab, label: '🏦 Financial Summary' },
    { id: 'rosca' as SpreadsheetTab, label: '🎡 ROSCA Draws', count: roscaRows.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Financial Spreadsheet</h1>
          <p className="text-sm text-gray-500">Edit contributions, expenses, and financials for {selectedGroup?.name}</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2.5 text-sm font-bold border-2 border-emerald-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-400 outline-none">
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Contributions Tab */}
      {activeTab === 'contributions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 font-bold uppercase">Total Due</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatUGX(totalDue)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 font-bold uppercase">Total Received</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatUGX(totalPaid)}</p>
            </div>
            <div className={`bg-white rounded-xl p-4 border shadow-sm ${totalBalance > 0 ? 'border-red-200' : 'border-gray-100'}`}>
              <p className="text-xs text-gray-500 font-bold uppercase">Outstanding</p>
              <p className={`text-xl font-bold mt-1 ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalBalance > 0 ? formatUGX(totalBalance) : '✅ 0'}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 font-bold uppercase">Behind</p>
              <p className={`text-xl font-bold mt-1 ${membersBehind > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{membersBehind > 0 ? membersBehind : '✅ 0'}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-emerald-50 border-b border-emerald-100">
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-left">#</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-left">Member</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-left hidden md:table-cell">Phone</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-right">Due</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-right">Paid</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-right">Balance</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase text-center">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : rows.map((row, i) => {
                    const bal = row.due - row.paid;
                    return (
                      <tr key={row.member_id} className={`hover:bg-emerald-50/30 ${row.saved ? 'bg-emerald-50' : ''}`}>
                        <td className="px-4 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900">{row.full_name}</td>
                        <td className="px-4 py-2 text-xs text-gray-500 font-mono hidden md:table-cell">{row.phone}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" value={row.due || ''} onChange={e => updateRow(row.member_id, 'due', parseInt(e.target.value) || 0)}
                            className="w-28 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono" placeholder="0" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" value={row.paid || ''} onChange={e => updateRow(row.member_id, 'paid', parseInt(e.target.value) || 0)}
                            className="w-28 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono" placeholder="0" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-sm font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{bal > 0 ? formatUGX(bal) : '✅'}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => saveRow(row)} disabled={saving === row.member_id}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${row.saved ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'} disabled:opacity-50`}>
                            {saving === row.member_id ? '...' : row.saved ? '✓ Saved' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td className="px-4 py-3" colSpan={2}><p className="text-sm font-bold text-emerald-800">{rows.length} members</p></td>
                  <td className="px-4 py-3 hidden md:table-cell"></td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatUGX(totalDue)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">{formatUGX(totalPaid)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{totalBalance > 0 ? formatUGX(totalBalance) : '✅ 0'}</td>
                  <td className="px-4 py-3"></td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total expenses for {period}: <span className="font-bold text-gray-900">{formatUGX(totalExpenses)}</span></p>
            </div>
            <button onClick={() => setShowExpenseForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              + Add Expense
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Description</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No expenses recorded for {period}.</td></tr>
                ) : expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{e.description}</td>
                    <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{e.category}</span></td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{formatUGX(e.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDeleteExpense(e.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="px-4 py-3" colSpan={2}><p className="text-sm font-bold text-gray-700">{expenses.length} expenses</p></td>
                <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{formatUGX(totalExpenses)}</td>
                <td className="px-4 py-3"></td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Financial Summary Tab */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Financial Position — {period}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Bank Balance (UGX)</label>
                <input type="number" value={bankBalance} onChange={e => setBankBalance(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono" placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Investments (UGX)</label>
                <input type="number" value={investments} onChange={e => setInvestments(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono" placeholder="0" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-bold text-gray-700 mb-1 block">Notes</label>
                <textarea value={financialNotes} onChange={e => setFinancialNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none resize-none" placeholder="Financial notes for this period" />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-emerald-600 font-bold uppercase">Total Collected</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatUGX(totalPaid)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs text-red-600 font-bold uppercase">Total Expenses</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatUGX(totalExpenses)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-blue-600 font-bold uppercase">Net Available</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatUGX(totalPaid - totalExpenses)}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleSaveFinancials} disabled={savingFinancials}
                className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {savingFinancials ? 'Saving...' : 'Save Financial Summary'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROSCA Tab */}
      {activeTab === 'rosca' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-gray-700">Select Cycle:</label>
              <select
                value={selectedRoscaCycle}
                onChange={e => setSelectedRoscaCycle(Number(e.target.value))}
                className="px-4 py-2.5 text-sm font-bold border-2 border-amber-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-400 outline-none"
              >
                {roscaCycles.map((c: any) => (
                  <option key={c.cycle_number} value={c.cycle_number}>
                    {c.cycle_name} (Draws: {c.total_draws})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {roscaLoading ? (
            <div className="text-center py-12 text-gray-500">Loading ROSCA data...</div>
          ) : roscaRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No ROSCA Data</h3>
              <p className="text-sm text-gray-500">No ROSCA cycles found for this group.</p>
            </div>
          ) : (
            <>
              {/* ROSCA Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-600 font-bold uppercase">Total Amount Received</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{formatUGX(roscaRows.reduce((s, r) => s + r.amountReceived, 0))}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-xs text-purple-600 font-bold uppercase">Total Security Savings</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">{formatUGX(roscaRows.reduce((s, r) => s + r.securitySavings, 0))}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs text-blue-600 font-bold uppercase">Total Paid Out</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{formatUGX(roscaRows.reduce((s, r) => s + r.drawContributions.reduce((a, b) => a + b, 0), 0))}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-bold uppercase">Total Balance</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatUGX(roscaRows.reduce((s, r) => s + r.balance, 0))}</p>
                </div>
              </div>

              {/* ROSCA Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-amber-50 border-b border-amber-100">
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-left">#</th>
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-left">Member</th>
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-left hidden md:table-cell">Phone</th>
                        {[...Array(10)].map((_, i) => (
                          <th key={i} className="px-2 py-3 text-xs font-extrabold text-amber-700 uppercase text-center">D{i + 1}</th>
                        ))}
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-right">Amount Received</th>
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-right">Security/Savings</th>
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-right">Balance</th>
                        <th className="px-3 py-3 text-xs font-extrabold text-amber-700 uppercase text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {roscaRows.map((row, i) => (
                        <tr key={row.member_id} className="hover:bg-amber-50/30">
                          <td className="px-3 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900">{row.full_name}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 font-mono hidden md:table-cell">{row.phone}</td>
                          {row.drawContributions.map((contrib, drawIdx) => (
                            <td key={drawIdx} className="px-1 py-2 text-center">
                              <input
                                type="number"
                                value={contrib || ''}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setRoscaRows(prev => prev.map(r => 
                                    r.member_id === row.member_id 
                                      ? { ...r, drawContributions: r.drawContributions.map((c, idx) => idx === drawIdx ? val : c), saved: false }
                                      : r
                                  ));
                                }}
                                className="w-14 px-1 py-1 text-xs text-center border border-gray-200 rounded focus:ring-2 focus:ring-amber-400 outline-none font-mono"
                                placeholder="0"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right text-sm font-bold text-emerald-600">{formatUGX(row.amountReceived)}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-purple-600">{formatUGX(row.securitySavings)}</td>
                          <td className={`px-3 py-2 text-right text-sm font-bold ${row.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatUGX(row.balance)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button 
                              onClick={() => saveRoscaRow(row)} 
                              disabled={saving === row.member_id}
                              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${row.saved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-600 text-white hover:bg-amber-700'} disabled:opacity-50`}
                            >
                              {saving === row.member_id ? '...' : row.saved ? '✓ Saved' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 border-t-2 border-amber-200">
                        <td className="px-3 py-3" colSpan={2}><p className="text-sm font-bold text-amber-800">{roscaRows.length} members</p></td>
                        <td className="px-3 py-3 hidden md:table-cell"></td>
                        {[...Array(10)].map((_, i) => (
                          <td key={i} className="px-1 py-3 text-center text-xs font-bold text-amber-700">
                            {formatUGX(roscaRows.reduce((s, r) => s + r.drawContributions[i], 0))}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatUGX(roscaRows.reduce((s, r) => s + r.amountReceived, 0))}</td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-purple-700">{formatUGX(roscaRows.reduce((s, r) => s + r.securitySavings, 0))}</td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-blue-700">{formatUGX(roscaRows.reduce((s, r) => s + r.balance, 0))}</td>
                        <td className="px-2 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">Only Chairman and Treasurer can edit. Data is saved per-period.</p>
    </div>
  );
};

export default SpreadsheetPage;

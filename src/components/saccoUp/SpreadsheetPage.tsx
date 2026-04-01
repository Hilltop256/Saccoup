import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getScheduleLabel } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface MemberRow {
  member_id: string;
  full_name: string;
  phone: string;
  due: number;
  paid: number;
  editing: boolean;
  saved: boolean;
}

const SpreadsheetPage: React.FC = () => {
  const { user, selectedGroup, isElevated, isChairman, isTreasurer } = useAppContext();
  const [period, setPeriod] = useState('2025');
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const periods = ['2024', '2025', '2026', '2027'];

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [memberResult, contribResult] = await Promise.all([
        ds.listMembers(selectedGroup.id),
        ds.listContributions(selectedGroup.id),
      ]);

      const members = (memberResult.members || []).map((m: any) => ({
        member_id: m.id,
        full_name: m.full_name,
        phone: m.phone || '',
        due: 0,
        paid: 0,
        editing: false,
        saved: false,
      }));

      // Map contributions for this period
      const contribs = (contribResult.contributions || []).filter((c: any) => {
        const cPeriod = c.period_label || '';
        return cPeriod === period || (cPeriod.includes(period));
      });

      for (const c of contribs) {
        const row = members.find(m => m.member_id === c.member_id);
        if (row) {
          const due = Number(c.amount_due || 0);
          const paid = Number(c.amount);
          if (due > 0) row.due = due;
          row.paid += paid;
        }
      }

      setRows(members.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id, period]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateRow = (memberId: string, field: 'due' | 'paid', value: number) => {
    setRows(prev => prev.map(r => r.member_id === memberId ? { ...r, [field]: value, saved: false } : r));
  };

  const saveRow = async (row: MemberRow) => {
    if (!selectedGroup?.id) return;
    setSaving(row.member_id);
    try {
      // Find existing contribution for this member/period
      const { data: existing } = await supabase
        .from('contributions')
        .select('id')
        .eq('group_id', selectedGroup.id)
        .eq('member_id', row.member_id)
        .eq('period_label', period)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('contributions')
          .update({
            amount: row.paid,
            amount_due: row.due,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('contributions')
          .insert({
            group_id: selectedGroup.id,
            member_id: row.member_id,
            member_name: row.full_name,
            amount: row.paid,
            amount_due: row.due,
            payment_method: 'bank_transfer',
            status: row.paid > 0 ? 'confirmed' : 'pending',
            period_label: period,
            notes: `Due: ${row.due}, Paid: ${row.paid}, Balance: ${row.due - row.paid}`,
          });
        if (error) throw error;
      }

      setRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, saved: true } : r));
      showToast(`${row.full_name} saved!`);
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    }
    setSaving(null);
  };

  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalBalance = totalDue - totalPaid;
  const membersBehind = rows.filter(r => r.due > 0 && r.paid < r.due).length;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Financial Spreadsheet</h1>
          <p className="text-sm text-gray-500">Enter and update member contributions for {selectedGroup?.name}</p>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2.5 text-sm font-bold border-2 border-emerald-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-400 outline-none"
        >
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Summary Cards */}
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
          <p className={`text-xl font-bold mt-1 ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalBalance > 0 ? formatUGX(totalBalance) : '✅ 0'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase">Members Behind</p>
          <p className={`text-xl font-bold mt-1 ${membersBehind > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {membersBehind > 0 ? membersBehind : '✅ 0'}
          </p>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-emerald-50 border-b border-emerald-100">
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-left">#</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-left">Member Name</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-left hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-right">Amount Due</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-right">Amount Paid</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-right">Balance</th>
                <th className="px-4 py-3 text-xs font-extrabold text-emerald-700 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No members found.</td></tr>
              ) : (
                rows.map((row, i) => {
                  const balance = row.due - row.paid;
                  return (
                    <tr key={row.member_id} className={`hover:bg-emerald-50/30 transition-colors ${row.saved ? 'bg-emerald-50' : ''}`}>
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-2">
                        <p className="text-sm font-semibold text-gray-900">{row.full_name}</p>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono hidden md:table-cell">{row.phone}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={row.due || ''}
                          onChange={e => updateRow(row.member_id, 'due', parseInt(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={row.paid || ''}
                          onChange={e => updateRow(row.member_id, 'paid', parseInt(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-mono"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {balance > 0 ? formatUGX(balance) : balance < 0 ? `+${formatUGX(Math.abs(balance))}` : '✅'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => saveRow(row)}
                          disabled={saving === row.member_id}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                            row.saved
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          } disabled:opacity-50`}
                        >
                          {saving === row.member_id ? '...' : row.saved ? '✓ Saved' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td className="px-4 py-3" colSpan={2}>
                  <p className="text-sm font-bold text-emerald-800">{rows.length} members</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell"></td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-bold text-gray-900">{formatUGX(totalDue)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-bold text-emerald-600">{formatUGX(totalPaid)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className={`text-sm font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {totalBalance > 0 ? formatUGX(totalBalance) : '✅ 0'}
                  </p>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Only Chairman and Treasurer can edit. Changes are saved per-row. Select a period above to switch between years.
      </p>
    </div>
  );
};

// Import supabase for direct queries
import { supabase } from '@/lib/supabase';

export default SpreadsheetPage;

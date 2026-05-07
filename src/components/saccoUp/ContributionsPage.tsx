import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getStatusColor, getPaymentMethodLabel, IMAGES, type PaymentMethod, type ContributionStatus } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface ContribRow {
  id: string; 
  member_name: string; 
  member_id: string; 
  amount: number;
  amount_due: number;
  payment_method: PaymentMethod; 
  status: ContributionStatus;
  period_label: string; 
  transaction_ref?: string; 
  created_at: string;
  member_photo?: string; 
  notes?: string;
}

interface MemberOption { 
  id: string; 
  full_name: string; 
  phone: string; 
}

/**
 * Generates contribution period options starting from Jan 2024
 * through 12 months into the future.
 */
function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const start = new Date(2024, 0, 1);
  const end = new Date();
  end.setMonth(end.getMonth() + 12);

  const current = new Date(end);
  while (current >= start) {
    const value = `${shortMonths[current.getMonth()]} ${current.getFullYear()}`;
    const label = `${monthNames[current.getMonth()]} ${current.getFullYear()}`;
    options.push({ value, label });
    current.setMonth(current.getMonth() - 1);
  }
  return options;
}

const PERIOD_OPTIONS = generatePeriodOptions();
const CURRENT_PERIOD = PERIOD_OPTIONS[0]?.value || '';

const ContributionsPage: React.FC = () => {
  const { user, selectedGroup, isElevated } = useAppContext();
  const [contributions, setContributions] = useState<ContribRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [newContribution, setNewContribution] = useState({
    member_id: '',
    amount: '',
    payment_method: 'mtn_momo' as PaymentMethod,
    transaction_ref: '',
    period_label: CURRENT_PERIOD,
  });

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { 
      setLoading(false); 
      return; 
    }
    setLoading(true);
    try {
      const [contribResult, memberResult] = await Promise.all([
        ds.listContributions(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);

      if (contribResult.success) {
        setContributions((contribResult.contributions || []).map((c: any) => {
          let amountDue = Number(c.amount_due || 0);
          if (!amountDue && c.notes) {
            const match = c.notes.match(/Due: (\d+)/);
            if (match) amountDue = parseInt(match[1]);
          }
          return {
            id: c.id, 
            member_name: c.member_name, 
            member_id: c.member_id,
            amount: Number(c.amount), 
            amount_due: amountDue,
            payment_method: c.payment_method,
            status: c.status, 
            period_label: c.period_label || '',
            transaction_ref: c.transaction_ref, 
            created_at: c.created_at?.split('T')[0] || '',
            member_photo: c.member_photo, 
            notes: c.notes,
          };
        }));
      }

      if (memberResult.success) {
        setMembers((memberResult.members || []).map((m: any) => ({
          id: m.id,
          full_name: m.full_name,
          phone: m.phone || '',
        })));
      }
    } catch (e) { 
      console.error('Failed to load contribution data:', e); 
    }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = contributions.filter(c => {
    const matchesSearch = c.member_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || c.payment_method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalConfirmed = contributions.filter(c => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0);
  const totalPending = contributions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const totalFailed = contributions.filter(c => c.status === 'failed').reduce((s, c) => s + c.amount, 0);

  const handleRecord = async () => {
    // Correctly determine member ID based on user permissions
    const targetMemberId = isElevated ? newContribution.member_id : (user?.member_id || '');
    
    if (!targetMemberId || !newContribution.amount || !selectedGroup?.id) return;
    
    setIsRecording(true); 
    setError(null);
    
    try {
      const result = await ds.recordContribution({
        group_id: selectedGroup.id,
        member_id: targetMemberId,
        amount: parseInt(newContribution.amount),
        amount_due: selectedGroup.contribution_amount || parseInt(newContribution.amount),
        payment_method: newContribution.payment_method,
        transaction_ref: newContribution.transaction_ref || undefined,
        period_label: newContribution.period_label,
        recorded_by: user?.member_id,
      });

      if (result.success) {
        setSuccess('Contribution recorded successfully!');
        setNewContribution({
          member_id: '', 
          amount: '', 
          payment_method: 'mtn_momo', 
          transaction_ref: '',
          period_label: CURRENT_PERIOD,
        });
        setShowRecordModal(false);
        await loadData();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) { 
      setError(e.message); 
    }
    setIsRecording(false);
  };

  const handleStatusChange = async (id: string, newStatus: ContributionStatus) => {
    try {
      await ds.updateContributionStatus(id, newStatus, user?.member_id);
      await loadData();
    } catch (e: any) { 
      setError(e.message); 
    }
  };

  // Validation logic to enable the submit button for both roles
  const isFormValid = isElevated ? !!newContribution.member_id : !!user?.member_id;

  if (!selectedGroup) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3>
        <p className="text-sm text-gray-500">Please select or create a group first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contributions</h1>
          <p className="text-sm text-gray-500">Track and manage group contributions for {selectedGroup.name}</p>
        </div>
        <button
          onClick={() => setShowRecordModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {isElevated ? 'Record Contribution' : 'Record My Payment'}
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{success}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Confirmed</p>
          <p className="text-xl font-bold text-gray-900">{formatUGX(totalConfirmed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Pending</p>
          <p className="text-xl font-bold text-amber-600">{formatUGX(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Failed</p>
          <p className="text-xl font-bold text-red-600">{formatUGX(totalFailed)}</p>
        </div>
      </div>

      {/* Filtering Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member name..."
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#0066CC]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg outline-none bg-white"
        >
          <option value="all">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg outline-none bg-white"
        >
          <option value="all">All Methods</option>
          <option value="mtn_momo">MTN MoMo</option>
          <option value="airtel_money">Airtel Money</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      {/* Contribution Table */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading contributions...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 font-semibold text-gray-600">Member</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 hidden sm:table-cell">Period</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{c.member_name}</p>
                      <p className="text-xs text-gray-500">{getPaymentMethodLabel(c.payment_method)}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-500 hidden sm:table-cell">{c.period_label}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatUGX(c.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {c.status === 'pending' && isElevated && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleStatusChange(c.id, 'confirmed')} className="text-emerald-600 hover:underline">Confirm</button>
                          <button onClick={() => handleStatusChange(c.id, 'failed')} className="text-red-600 hover:underline">Fail</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRecordModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {isElevated ? 'Record Contribution' : 'Record My Payment'}
            </h2>
            
            <div className="space-y-4">
              {isElevated ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Member *</label>
                  <select
                    value={newContribution.member_id}
                    onChange={(e) => setNewContribution({ ...newContribution, member_id: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none"
                  >
                    <option value="">Select member</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Member</label>
                  <p className="px-3 py-2.5 text-sm font-bold text-gray-900 bg-gray-50 rounded-lg border">{user?.full_name || 'You'}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (UGX) *</label>
                <input
                  type="number"
                  value={newContribution.amount}
                  onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none"
                  placeholder={String(selectedGroup.contribution_amount || 50000)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                <select
                  value={newContribution.payment_method}
                  onChange={(e) => setNewContribution({ ...newContribution, payment_method: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none"
                >
                  <option value="mtn_momo">📱 MTN MoMo</option>
                  <option value="airtel_money">📱 Airtel Money</option>
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              <div>
 <label className="text-sm font-medium text-gray-700 mb-1 block">Transaction Reference (Phone Number and Transaction ID For Verification)</label>
                <input
                  type="text"
                  value={newContribution.transaction_ref}
                  onChange={(e) => setNewContribution({ ...newContribution, transaction_ref: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none font-mono"
                  placeholder="ID or Phone Number used"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Period</label>
                <select
                  value={newContribution.period_label}
                  onChange={(e) => setNewContribution({ ...newContribution, period_label: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none"
                >
                  {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRecordModal(false)} className="flex-1 py-2.5 text-sm font-medium bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleRecord}
                disabled={isRecording || !isFormValid || !newContribution.amount}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg disabled:opacity-50"
              >
                {isRecording ? 'Recording...' : 'Record Contribution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContributionsPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getStatusColor, getPaymentMethodLabel, IMAGES, type PaymentMethod, type ContributionStatus } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface ContribRow {
  id: string; member_name: string; member_id: string; amount: number;
  payment_method: PaymentMethod; status: ContributionStatus;
  period_label: string; transaction_ref?: string; created_at: string;
  member_photo?: string;
}

interface MemberOption { id: string; full_name: string; phone: string; }

// Generate period options from Jan 2024 to 12 months ahead
function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Start from Jan 2024, go 12 months past current date
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

// Uganda phone number normalizer
function normUgPhone(ph: string): string {
  let c = ph.replace(/[\s\-()]/g, '');
  if (c.startsWith('0')) c = '+256' + c.substring(1);
  else if (c.startsWith('256') && !c.startsWith('+')) c = '+' + c;
  else if (!c.startsWith('+')) c = '+256' + c;
  return c;
}

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
  const [momoPrompt, setMomoPrompt] = useState<string | null>(null);
  const [newContribution, setNewContribution] = useState({
    member_id: '',
    amount: '',
    payment_method: 'mtn_momo' as PaymentMethod,
    transaction_ref: '',
    period_label: CURRENT_PERIOD,
    use_momo_push: false,
    momo_phone: '',
  });

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [contribResult, memberResult] = await Promise.all([
        ds.listContributions(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);
      if (contribResult.success) {
        setContributions((contribResult.contributions || []).map((c: any) => ({
          id: c.id, member_name: c.member_name, member_id: c.member_id,
          amount: Number(c.amount), payment_method: c.payment_method,
          status: c.status, period_label: c.period_label || '',
          transaction_ref: c.transaction_ref, created_at: c.created_at?.split('T')[0] || '',
          member_photo: c.member_photo,
        })));
      }
      if (memberResult.success) {
        setMembers((memberResult.members || []).map((m: any) => ({
          id: m.id,
          full_name: m.full_name,
          phone: m.phone || '',
        })));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-populate MoMo phone when member selected
  useEffect(() => {
    if (newContribution.member_id) {
      const m = members.find(m => m.id === newContribution.member_id);
      if (m?.phone) {
        setNewContribution(prev => ({ ...prev, momo_phone: m.phone }));
      }
    }
  }, [newContribution.member_id, members]);

  const isMoMoMethod = newContribution.payment_method === 'mtn_momo' || newContribution.payment_method === 'airtel_money';

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
    const memberId = isElevated ? newContribution.member_id : (user?.member_id || '');
    if (!memberId || !newContribution.amount || !selectedGroup?.id) return;
    setIsRecording(true); setError(null); setMomoPrompt(null);
    try {
      if (isMoMoMethod && newContribution.use_momo_push && newContribution.momo_phone) {
        // Initiate MoMo push payment
        const normalizedPhone = normUgPhone(newContribution.momo_phone);
        const result = await ds.initiateMoMoPayment({
          group_id: selectedGroup.id,
          member_id: memberId,
          phone: normalizedPhone,
          amount: parseInt(newContribution.amount),
          period_label: newContribution.period_label,
          provider: newContribution.payment_method as 'mtn_momo' | 'airtel_money',
          recorded_by: user?.member_id,
        });
        if (result.success) {
          setMomoPrompt(result.message);
          setSuccess('Payment request sent! Awaiting member approval on their phone.');
          setNewContribution({
            member_id: '', amount: '', payment_method: 'mtn_momo', transaction_ref: '',
            period_label: CURRENT_PERIOD, use_momo_push: false, momo_phone: '',
          });
          setShowRecordModal(false);
          await loadData();
          setTimeout(() => { setSuccess(null); setMomoPrompt(null); }, 8000);
        }
      } else {
        // Manual record
        const result = await ds.recordContribution({
          group_id: selectedGroup.id,
          member_id: memberId,
          amount: parseInt(newContribution.amount),
          payment_method: newContribution.payment_method,
          transaction_ref: newContribution.transaction_ref || undefined,
          period_label: newContribution.period_label,
          recorded_by: user?.member_id,
        });
        if (result.success) {
          setSuccess('Contribution recorded successfully!');
          setNewContribution({
            member_id: '', amount: '', payment_method: 'mtn_momo', transaction_ref: '',
            period_label: CURRENT_PERIOD, use_momo_push: false, momo_phone: '',
          });
          setShowRecordModal(false);
          await loadData();
          setTimeout(() => setSuccess(null), 4000);
        }
      }
    } catch (e: any) { setError(e.message); }
    setIsRecording(false);
  };

  const handleStatusChange = async (id: string, newStatus: ContributionStatus) => {
    try {
      await ds.updateContributionStatus(id, newStatus, user?.member_id);
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

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
          <div>
            <p>{success}</p>
            {momoPrompt && <p className="mt-1 text-emerald-600 font-medium">{momoPrompt}</p>}
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Confirmed</p>
              <p className="text-xl font-bold text-gray-900">{formatUGX(totalConfirmed)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-900">{formatUGX(totalPending)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-xl font-bold text-gray-900">{formatUGX(totalFailed)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member name..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
        >
          <option value="all">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
        >
          <option value="all">All Methods</option>
          <option value="mtn_momo">MTN MoMo</option>
          <option value="airtel_money">Airtel Money</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <svg className="w-8 h-8 animate-spin text-[#0066CC] mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading contributions...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Period</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Method</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No contributions recorded yet. Click "Record Contribution" to add one.
                    </td>
                  </tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.member_photo || IMAGES.avatars[0]}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = IMAGES.avatars[0]; }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.member_name}</p>
                          <p className="text-xs text-gray-500">{c.created_at}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{c.period_label}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {getPaymentMethodLabel(c.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatUGX(c.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'pending' && isElevated && (
                          <>
                            <button
                              onClick={() => handleStatusChange(c.id, 'confirmed')}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Confirm payment"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleStatusChange(c.id, 'failed')}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Mark as failed"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        {c.transaction_ref && (
                          <span className="text-[10px] text-gray-400 font-mono" title="Transaction ref">
                            {c.transaction_ref}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Contribution Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRecordModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{isElevated ? 'Record Contribution' : 'Record My Payment'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedGroup.name}</p>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
            )}

            <div className="space-y-4">
              {isElevated ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Member *</label>
                <select
                  value={newContribution.member_id}
                  onChange={(e) => setNewContribution({ ...newContribution, member_id: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select member</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Member</label>
                <p className="px-3 py-2.5 text-sm font-bold text-gray-900 bg-gray-50 rounded-lg border border-gray-200">
                  {user?.full_name || 'You'}
                </p>
              </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (UGX) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">UGX</span>
                  <input
                    type="number"
                    value={newContribution.amount}
                    onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value })}
                    className="w-full pl-14 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                    placeholder={String(selectedGroup.contribution_amount || 50000)}
                    min="1000"
                  />
                </div>
                {selectedGroup.contribution_amount > 0 && (
                  <button
                    type="button"
                    onClick={() => setNewContribution({ ...newContribution, amount: String(selectedGroup.contribution_amount) })}
                    className="mt-1 text-xs text-[#0066CC] hover:underline"
                  >
                    Use standard amount: {formatUGX(selectedGroup.contribution_amount)}
                  </button>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                <select
                  value={newContribution.payment_method}
                  onChange={(e) => setNewContribution({ ...newContribution, payment_method: e.target.value as PaymentMethod, use_momo_push: false })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                >
                  <option value="mtn_momo">📱 MTN MoMo</option>
                  <option value="airtel_money">📱 Airtel Money</option>
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              {/* MTN MoMo / Airtel Money push option */}
              {isMoMoMethod && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="momo_push"
                      checked={newContribution.use_momo_push}
                      onChange={(e) => setNewContribution({ ...newContribution, use_momo_push: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[#0066CC]"
                    />
                    <label htmlFor="momo_push" className="text-sm font-medium text-blue-800 cursor-pointer">
                      Send payment request to member's phone
                    </label>
                  </div>
                  {newContribution.use_momo_push && (
                    <div>
                      <label className="text-xs font-medium text-blue-700 mb-1 block">
                        {newContribution.payment_method === 'mtn_momo' ? 'MTN' : 'Airtel'} Phone Number
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-2.5 py-2 text-xs text-gray-500 bg-white border border-r-0 border-blue-200 rounded-l-lg font-medium">+256</span>
                        <input
                          type="tel"
                          value={newContribution.momo_phone.replace('+256', '').replace('256', '')}
                          onChange={(e) => setNewContribution({ ...newContribution, momo_phone: '+256' + e.target.value.replace(/\D/g, '') })}
                          className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-r-lg bg-white focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                          placeholder="7XX XXX XXX"
                        />
                      </div>
                      <p className="text-[10px] text-blue-600 mt-1">
                        {newContribution.payment_method === 'mtn_momo'
                          ? 'Member will receive a MoMo prompt to approve the payment'
                          : 'Member will receive an Airtel Money debit request'}
                      </p>
                    </div>
                  )}
                  {!newContribution.use_momo_push && (
                    <p className="text-xs text-blue-600">
                      Or manually record an existing payment with a transaction reference below.
                    </p>
                  )}
                </div>
              )}

              {(!isMoMoMethod || !newContribution.use_momo_push) && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Transaction Reference {newContribution.payment_method !== 'cash' ? '(recommended)' : '(optional)'}
                  </label>
                  <input
                    type="text"
                    value={newContribution.transaction_ref}
                    onChange={(e) => setNewContribution({ ...newContribution, transaction_ref: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none font-mono"
                    placeholder={newContribution.payment_method === 'mtn_momo' ? 'e.g. TXN123456789' : newContribution.payment_method === 'airtel_money' ? 'e.g. AIR123456789' : 'Optional reference'}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Period</label>
                <select
                  value={newContribution.period_label}
                  onChange={(e) => setNewContribution({ ...newContribution, period_label: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                >
                  {PERIOD_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRecordModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecord}
                disabled={isRecording || !newContribution.member_id || !newContribution.amount}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRecording ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {newContribution.use_momo_push ? 'Sending request...' : 'Recording...'}
                  </>
                ) : (
                  newContribution.use_momo_push ? 'Send Payment Request' : 'Record Contribution'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContributionsPage;

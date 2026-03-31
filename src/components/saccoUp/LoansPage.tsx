import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getStatusColor, IMAGES, type LoanStatus } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface LoanRow {
  id: string; member_name: string; member_id: string; amount: number;
  interest_rate: number; purpose: string; repayment_period_months: number;
  status: LoanStatus; created_at: string; guarantors: string[]; member_photo?: string;
  repaid_amount: number;
}

interface MemberOption { id: string; full_name: string; }

const LoansPage: React.FC = () => {
  const { user, selectedGroup, isElevated } = useAppContext();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newLoan, setNewLoan] = useState({ member_id: '', amount: '', purpose: '', repayment_period_months: '6', guarantor_ids: [] as string[] });
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [loanResult, memberResult] = await Promise.all([
        ds.listLoans(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
      ]);
      if (loanResult.success) {
        setLoans((loanResult.loans || []).map((l: any) => ({
          id: l.id, member_name: l.member_name, member_id: l.member_id,
          amount: Number(l.amount), interest_rate: Number(l.interest_rate),
          purpose: l.purpose || '', repayment_period_months: l.repayment_period_months,
          status: l.status, created_at: l.created_at?.split('T')[0] || '',
          guarantors: l.guarantors || [], member_photo: l.member_photo,
          repaid_amount: Number(l.repaid_amount || 0),
        })));
      }
      if (memberResult.success) {
        setMembers((memberResult.members || []).map((m: any) => ({ id: m.id, full_name: m.full_name })));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = loans.filter(l => statusFilter === 'all' || l.status === statusFilter);
  const totalDisbursed = loans.filter(l => l.status === 'disbursed' || l.status === 'repaying').reduce((s, l) => s + l.amount, 0);
  const totalPending = loans.filter(l => ['pending', 'approved', 'treasurer_approved'].includes(l.status)).reduce((s, l) => s + l.amount, 0);

  const handleApply = async () => {
    if (!newLoan.member_id || !newLoan.amount || !newLoan.purpose || !selectedGroup?.id) return;
    setIsApplying(true); setError(null);
    try {
      const result = await ds.applyLoan({
        group_id: selectedGroup.id,
        member_id: newLoan.member_id,
        amount: parseInt(newLoan.amount),
        purpose: newLoan.purpose,
        repayment_period_months: parseInt(newLoan.repayment_period_months),
        guarantor_ids: newLoan.guarantor_ids,
      });
      if (result.success) {
        setSuccess('Loan application submitted successfully!');
        setNewLoan({ member_id: '', amount: '', purpose: '', repayment_period_months: '6', guarantor_ids: [] });
        setShowApplyModal(false);
        await loadData();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) { setError(e.message); }
    setIsApplying(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: LoanStatus) => {
    try {
      await ds.updateLoanStatus(id, newStatus, user?.member_id);
      setSelectedLoan(null);
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const handleRepayment = async () => {
    if (!selectedLoan || !repaymentAmount) return;
    const amount = parseInt(repaymentAmount);
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid repayment amount.'); return; }
    const remaining = selectedLoan.amount - selectedLoan.repaid_amount;
    if (amount > remaining) { setError(`Repayment cannot exceed remaining balance of ${formatUGX(remaining)}.`); return; }
    setIsRepaying(true);
    setError(null);
    try {
      await ds.recordRepayment(selectedLoan.id, amount, user?.member_id);
      setSuccess(`Repayment of ${formatUGX(amount)} recorded.`);
      setRepaymentAmount('');
      setSelectedLoan(null);
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); }
    setIsRepaying(false);
  };

  const getNextStatus = (status: LoanStatus): { label: string; status: LoanStatus; color: string } | null => {
    switch (status) {
      case 'pending': return { label: 'Approve (Treasurer)', status: 'treasurer_approved', color: 'bg-blue-600' };
      case 'treasurer_approved': return { label: 'Approve (Chairperson)', status: 'approved', color: 'bg-emerald-600' };
      case 'approved': return { label: 'Disburse Funds', status: 'disbursed', color: 'bg-[#0066CC]' };
      case 'disbursed': return { label: 'Start Repayment', status: 'repaying', color: 'bg-purple-600' };
      default: return null;
    }
  };

  const calcMonthlyPayment = (amount: number, rate: number, months: number) => {
    const totalInterest = amount * (rate / 100) * months;
    return Math.ceil((amount + totalInterest) / months);
  };

  if (!selectedGroup) {
    return <div className="bg-white rounded-xl border p-12 text-center"><h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Loans</h1><p className="text-sm text-gray-500">Manage loan applications and repayments</p></div>
        <button onClick={() => setShowApplyModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Loan Application
        </button>
      </div>

      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5"><p className="text-xs text-gray-500">Active Loans</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatUGX(totalDisbursed)}</p></div>
        <div className="bg-white rounded-xl border p-5"><p className="text-xs text-gray-500">Pending Approval</p><p className="text-2xl font-bold text-amber-600 mt-1">{formatUGX(totalPending)}</p></div>
        <div className="bg-white rounded-xl border p-5"><p className="text-xs text-gray-500">Interest Rate</p><p className="text-2xl font-bold text-gray-900 mt-1">{selectedGroup.interest_rate || 5}%</p></div>
        <div className="bg-white rounded-xl border p-5"><p className="text-xs text-gray-500">Total Applications</p><p className="text-2xl font-bold text-[#00CC99] mt-1">{loans.length}</p></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'treasurer_approved', 'approved', 'disbursed', 'repaying', 'completed', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize ${statusFilter === s ? 'bg-[#0066CC] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center"><svg className="w-8 h-8 animate-spin text-[#0066CC] mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-500">No loan applications found.</div>
          ) : filtered.map((loan) => {
            const nextAction = getNextStatus(loan.status);
            const monthly = calcMonthlyPayment(loan.amount, loan.interest_rate, loan.repayment_period_months);
            return (
              <div key={loan.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md cursor-pointer" onClick={() => setSelectedLoan(loan)}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <img src={loan.member_photo || IMAGES.avatars[0]} alt="" className="w-11 h-11 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{loan.member_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${getStatusColor(loan.status)}`}>{loan.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{loan.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatUGX(loan.amount)}</p>
                      <p className="text-xs text-gray-500">{formatUGX(monthly)}/mo x {loan.repayment_period_months}</p>
                      {(loan.status === 'disbursed' || loan.status === 'repaying' || loan.status === 'completed') && (
                        <p className={`text-xs font-medium mt-1 ${loan.status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {formatUGX(loan.repaid_amount)} repaid
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {nextAction && isElevated && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Guarantors: {loan.guarantors.join(', ') || 'None'}</p>
                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(loan.id, nextAction.status); }} className={`px-3 py-1.5 text-xs font-medium text-white ${nextAction.color} rounded-lg hover:opacity-90`}>
                      {nextAction.label}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">New Loan Application</h2>
              <button onClick={() => setShowApplyModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Applicant *</label>
                <select value={newLoan.member_id} onChange={(e) => setNewLoan({...newLoan, member_id: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                  <option value="">Select member</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (UGX) *</label>
                <input type="number" value={newLoan.amount} onChange={(e) => setNewLoan({...newLoan, amount: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg" placeholder="200000" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Purpose *</label>
                <textarea value={newLoan.purpose} onChange={(e) => setNewLoan({...newLoan, purpose: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none" rows={3} placeholder="Describe the loan purpose..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Repayment Period</label>
                <select value={newLoan.repayment_period_months} onChange={(e) => setNewLoan({...newLoan, repayment_period_months: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
                  {[1,2,3,6,9,12].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Guarantors</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {members.filter(m => m.id !== newLoan.member_id).map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newLoan.guarantor_ids.includes(m.id)} onChange={(e) => {
                        if (e.target.checked) setNewLoan({...newLoan, guarantor_ids: [...newLoan.guarantor_ids, m.id]});
                        else setNewLoan({...newLoan, guarantor_ids: newLoan.guarantor_ids.filter(id => id !== m.id)});
                      }} className="w-4 h-4 rounded border-gray-300 text-[#0066CC]" />
                      <span className="text-sm text-gray-700">{m.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {newLoan.amount && (
                <div className="bg-[#0066CC]/5 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Estimated Monthly Payment</p>
                  <p className="text-lg font-bold text-[#0066CC]">{formatUGX(calcMonthlyPayment(parseInt(newLoan.amount) || 0, 5, parseInt(newLoan.repayment_period_months)))}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowApplyModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleApply} disabled={isApplying || !newLoan.member_id || !newLoan.amount || !newLoan.purpose} className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] disabled:opacity-50">
                {isApplying ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Detail Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLoan(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Loan Details</h2>
              <button onClick={() => setSelectedLoan(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src={selectedLoan.member_photo || IMAGES.avatars[0]} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedLoan.member_name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedLoan.status)}`}>{selectedLoan.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Amount</p><p className="text-lg font-bold">{formatUGX(selectedLoan.amount)}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Interest</p><p className="text-lg font-bold">{selectedLoan.interest_rate}% flat</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Period</p><p className="text-lg font-bold">{selectedLoan.repayment_period_months} months</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Monthly</p><p className="text-lg font-bold">{formatUGX(calcMonthlyPayment(selectedLoan.amount, selectedLoan.interest_rate, selectedLoan.repayment_period_months))}</p></div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Purpose</p><p className="text-sm">{selectedLoan.purpose}</p></div>
              {selectedLoan.guarantors.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Guarantors</p><div className="flex flex-wrap gap-2">{selectedLoan.guarantors.map((g, i) => <span key={i} className="px-2 py-1 bg-white rounded text-xs font-medium border">{g}</span>)}</div></div>
              )}
              {/* Repayment progress & recording */}
              {(selectedLoan.status === 'disbursed' || selectedLoan.status === 'repaying' || selectedLoan.status === 'completed') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Repayment Progress</p>
                    <p className="text-sm font-bold text-blue-800">{formatUGX(selectedLoan.repaid_amount)} / {formatUGX(selectedLoan.amount)}</p>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (selectedLoan.repaid_amount / selectedLoan.amount) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-600">
                    {selectedLoan.status === 'completed'
                      ? 'Fully repaid'
                      : `Remaining: ${formatUGX(selectedLoan.amount - selectedLoan.repaid_amount)}`
                    }
                  </p>
                  {selectedLoan.status !== 'completed' && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="number"
                        value={repaymentAmount}
                        onChange={(e) => setRepaymentAmount(e.target.value)}
                        placeholder="Amount (UGX)"
                        className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                      />
                      <button
                        onClick={handleRepayment}
                        disabled={isRepaying || !repaymentAmount}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isRepaying ? '...' : 'Record'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              {getNextStatus(selectedLoan.status) && isElevated && (
                <button onClick={() => handleStatusUpdate(selectedLoan.id, getNextStatus(selectedLoan.status)!.status)} className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99]">
                  {getNextStatus(selectedLoan.status)!.label}
                </button>
              )}
              {(selectedLoan.status === 'pending' || selectedLoan.status === 'treasurer_approved') && isElevated && (
                <button onClick={() => handleStatusUpdate(selectedLoan.id, 'rejected')} className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Reject</button>
              )}
              <button onClick={() => setSelectedLoan(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoansPage;

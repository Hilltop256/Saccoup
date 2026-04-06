import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';
import { formatUGX, PBS_MEMBERS } from '@/lib/constants';

interface MemberStatement {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  total_contributions: number;
  savings_balance: number;
  loan_balance: number;
  net_position: number;
}

interface ContributionRow {
  id: string;
  member_name: string;
  amount: number;
  payment_method: string;
  status: string;
  period_label: string;
  created_at: string;
}

interface LoanRow {
  id: string;
  member_name: string;
  amount: number;
  purpose: string;
  status: string;
  interest_rate: number;
  repayment_period_months: number;
  created_at: string;
}

interface GroupStatsData {
  total_savings: number;
  total_loans_outstanding: number;
  member_count: number;
  total_contributions: number;
  confirmed_contributions: number;
  pending_contributions: number;
  failed_contributions: number;
  collection_rate: number;
}

const getPaymentLabel = (method: string): string => {
  switch (method) {
    case 'mtn_momo': return 'MTN MoMo';
    case 'airtel_money': return 'Airtel Money';
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
    default: return method || 'N/A';
  }
};

const getStatusLabel = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const ReportsPage: React.FC = () => {
  const { user, selectedGroup } = useAppContext();
  const { cycles, getMemberStats, getGroupTotals, isMockData } = useRoscaData();
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState('6months');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const groupType = (selectedGroup?.group_type || '').toLowerCase();
  const isRoscaType = groupType === 'rosca' || groupType === 'hybrid';

  const [stats, setStats] = useState<GroupStatsData | null>(null);
  const [members, setMembers] = useState<MemberStatement[]>([]);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);

  const loadReportData = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);

    // For ROSCA type groups, use PBS_MEMBERS instead of Supabase members
    if (isRoscaType) {
      setMembers(PBS_MEMBERS.map(m => ({
        id: m.id,
        full_name: m.full_name,
        phone: '',
        role: 'member',
        total_contributions: 0,
        savings_balance: 0,
        loan_balance: 0,
        net_position: 0,
      })));
      setLoading(false);
      return;
    }

    try {
      const [statsRes, membersRes, contribRes, loansRes] = await Promise.allSettled([
        ds.getGroupStats(selectedGroup.id),
        ds.listMembers(selectedGroup.id),
        ds.listContributions(selectedGroup.id, { limit: 100 }),
        ds.listLoans(selectedGroup.id),
      ]);

      // Stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.stats) {
        const s = statsRes.value.stats;
        setStats({
          total_savings: s.total_savings || 0,
          total_loans_outstanding: s.total_loans_outstanding || 0,
          member_count: s.member_count || 0,
          total_contributions: s.total_contributions || 0,
          confirmed_contributions: s.confirmed_contributions || 0,
          pending_contributions: s.pending_contributions || 0,
          failed_contributions: s.failed_contributions || 0,
          collection_rate: s.collection_rate || 0,
        });
      }

      // Members
      if (membersRes.status === 'fulfilled' && membersRes.value?.members) {
        // Compute outstanding balance from contributions for savings groups
        const contribsData = contribRes.status === 'fulfilled' ? (contribRes.value?.contributions || []) : [];
        const memberOutstanding: Record<string, number> = {};
        for (const c of contribsData) {
          const due = Number(c.amount_due || 0);
          const paid = Number(c.amount);
          if (due > 0) {
            memberOutstanding[c.member_id] = (memberOutstanding[c.member_id] || 0) + (due - paid);
          }
        }

        setMembers(membersRes.value.members.map((m: any) => ({
          id: m.id,
          full_name: m.full_name || 'Unknown',
          phone: m.phone || '',
          role: m.role || 'member',
          total_contributions: m.totalContributions || m.total_contributions || 0,
          savings_balance: m.savingsBalance || m.savings_balance || 0,
          loan_balance: memberOutstanding[m.id] || m.loanBalance || m.loan_balance || 0,
          net_position: (m.savingsBalance || m.savings_balance || 0) - (memberOutstanding[m.id] || m.loanBalance || m.loan_balance || 0),
        })));
      }

      // Contributions
      if (contribRes.status === 'fulfilled' && contribRes.value?.contributions) {
        setContributions(contribRes.value.contributions.map((c: any) => ({
          id: c.id,
          member_name: c.member_name || c.members?.full_name || 'Unknown',
          amount: c.amount || 0,
          payment_method: c.payment_method || '',
          status: c.status || 'pending',
          period_label: c.period_label || '',
          created_at: c.created_at?.split('T')[0] || '',
        })));
      }

      // Loans
      if (loansRes.status === 'fulfilled' && loansRes.value?.loans) {
        setLoans(loansRes.value.loans.map((l: any) => ({
          id: l.id,
          member_name: l.member_name || l.members?.full_name || 'Unknown',
          amount: l.amount || 0,
          purpose: l.purpose || '',
          status: l.status || 'pending',
          interest_rate: l.interest_rate || 0,
          repayment_period_months: l.repayment_period_months || 0,
          created_at: l.created_at?.split('T')[0] || '',
        })));
      }
    } catch (e) {
      console.error('Report data load error:', e);
    }

    setLoading(false);
  }, [selectedGroup?.id, isRoscaType]);

  useEffect(() => { loadReportData(); }, [loadReportData]);

  // Computed totals
  const totalSavings = stats?.total_savings || members.reduce((s, m) => s + m.savings_balance, 0);
  const totalLoans = stats?.total_loans_outstanding || members.reduce((s, m) => s + m.loan_balance, 0);
  const totalContributions = stats?.total_contributions || members.reduce((s, m) => s + m.total_contributions, 0);
  const totalMemberContributions = members.reduce((s, m) => s + m.total_contributions, 0);
  const netPosition = totalSavings - totalLoans;

  // Loan portfolio stats
  const activeLoans = loans.filter(l => ['disbursed', 'repaying'].includes(l.status));
  const pendingLoans = loans.filter(l => ['pending', 'treasurer_approved', 'approved'].includes(l.status));
  const completedLoans = loans.filter(l => l.status === 'completed');
  const defaultedLoans = loans.filter(l => l.status === 'defaulted');
  const totalLoansDisbursed = activeLoans.reduce((s, l) => s + l.amount, 0);

  // Contribution breakdown
  const confirmedContribs = contributions.filter(c => c.status === 'confirmed');
  const pendingContribs = contributions.filter(c => c.status === 'pending');
  const failedContribs = contributions.filter(c => c.status === 'failed');

  // ===== PDF EXPORT =====
  const generatePdfReport = () => {
    setExporting(true);

    const groupName = selectedGroup?.name || 'Group';
    const reportDate = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
    const generatedBy = user?.full_name || 'System';

    const memberRows = members.map(m => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;">${m.full_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-transform:capitalize;">${m.role}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatUGX(m.total_contributions)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:#0066CC;">${formatUGX(m.savings_balance)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:#D97706;">${formatUGX(m.loan_balance)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:600;color:${m.net_position >= 0 ? '#059669' : '#DC2626'};">${formatUGX(m.net_position)}</td>
      </tr>
    `).join('');

    const contribRows = contributions.slice(0, 50).map(c => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${c.created_at}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${c.member_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;">${formatUGX(c.amount)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${getPaymentLabel(c.payment_method)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${c.period_label}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-transform:capitalize;">${c.status}</td>
      </tr>
    `).join('');

    const loanRows = loans.map(l => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${l.member_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;">${formatUGX(l.amount)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${l.purpose}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${l.interest_rate}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;">${l.repayment_period_months} months</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-transform:capitalize;">${l.status.replace(/_/g, ' ')}</td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${groupName} - Financial Report</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .page-break { page-break-before: always; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { color: #0066CC; margin: 0; font-size: 24px; }
    h2 { color: #333; font-size: 18px; margin-top: 32px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #0066CC; }
    h3 { color: #555; font-size: 14px; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f8f9fa; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
    th.right { text-align: right; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0066CC; padding-bottom: 16px; margin-bottom: 24px; }
    .header-right { text-align: right; font-size: 12px; color: #666; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .summary-card { background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #0066CC; }
    .summary-card.green { border-left-color: #059669; }
    .summary-card.amber { border-left-color: #D97706; }
    .summary-card .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-card .value { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; text-align: center; }
    .totals-row td { font-weight: 700; background: #f8f9fa; border-top: 2px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${groupName}</h1>
      <p style="color:#666;font-size:14px;margin:4px 0 0;">Financial Report</p>
    </div>
    <div class="header-right">
      <p><strong>Report Date:</strong> ${reportDate}</p>
      <p><strong>Generated By:</strong> ${generatedBy}</p>
      <p><strong>Period:</strong> ${dateRange === '1month' ? 'Last Month' : dateRange === '3months' ? 'Last 3 Months' : dateRange === '6months' ? 'Last 6 Months' : 'Last Year'}</p>
    </div>
  </div>

  <h2>Balance Sheet Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">SACCO Group Savings</div>
      <div class="value" style="color:#0066CC;">${formatUGX(totalSavings)}</div>
    </div>
    <div class="summary-card green">
      <div class="label">Total Contributions</div>
      <div class="value" style="color:#059669;">${formatUGX(totalContributions)}</div>
    </div>
    <div class="summary-card amber">
      <div class="label">Outstanding Loans</div>
      <div class="value" style="color:#D97706;">${formatUGX(totalLoans)}</div>
    </div>
  </div>
  ${isRoscaType ? `<div class="summary-grid">
    <div class="summary-card" style="border-left-color:#7c3aed;">
      <div class="label">ROSCA Total Paid Out</div>
      <div class="value" style="color:#7c3aed;">${formatUGX(roscaGroupTotals.totalPaidOut)}</div>
    </div>
    <div class="summary-card" style="border-left-color:#059669;">
      <div class="label">ROSCA Total Savings</div>
      <div class="value" style="color:#059669;">${formatUGX(roscaGroupTotals.totalSavings)}</div>
    </div>
    <div class="summary-card" style="border-left-color:#f97316;">
      <div class="label">ROSCA Deductions</div>
      <div class="value" style="color:#f97316;">${formatUGX(roscaGroupTotals.totalDeductions)}</div>
    </div>
  </div>` : ''}
  <div class="summary-grid">
    <div class="summary-card ${netPosition >= 0 ? 'green' : ''}">
      <div class="label">Net Position (SACCO)</div>
      <div class="value" style="color:${netPosition >= 0 ? '#059669' : '#DC2626'};">${formatUGX(netPosition)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Active Members</div>
      <div class="value">${members.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Collection Rate</div>
      <div class="value">${Math.round(stats?.collection_rate || 0)}%</div>
    </div>
  </div>

  <div class="page-break"></div>
  <h2>Member Statements</h2>
  <table>
    <thead>
      <tr>
        <th>Member</th>
        <th>Role</th>
        <th class="right">Contributions</th>
        <th class="right">Savings</th>
        <th class="right">Loans</th>
        <th class="right">Net Position</th>
      </tr>
    </thead>
    <tbody>
      ${memberRows}
    </tbody>
    <tfoot>
      <tr class="totals-row">
        <td style="padding:10px 12px;font-size:13px;" colspan="2"><strong>TOTALS</strong></td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${formatUGX(totalMemberContributions)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#0066CC;">${formatUGX(totalSavings)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#D97706;">${formatUGX(totalLoans)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:${netPosition >= 0 ? '#059669' : '#DC2626'};">${formatUGX(netPosition)}</td>
      </tr>
    </tfoot>
  </table>

  ${contributions.length > 0 ? `
  <div class="page-break"></div>
  <h2>Contribution History</h2>
  <h3>Summary: ${confirmedContribs.length} confirmed, ${pendingContribs.length} pending, ${failedContribs.length} failed</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Member</th>
        <th class="right">Amount</th>
        <th>Method</th>
        <th>Period</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${contribRows}</tbody>
  </table>
  ` : ''}

  ${loans.length > 0 ? `
  <div class="page-break"></div>
  <h2>Loan Portfolio</h2>
  <h3>Active: ${activeLoans.length} | Pending: ${pendingLoans.length} | Completed: ${completedLoans.length} | Defaulted: ${defaultedLoans.length}</h3>
  <table>
    <thead>
      <tr>
        <th>Member</th>
        <th class="right">Amount</th>
        <th>Purpose</th>
        <th>Rate</th>
        <th>Term</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${loanRows}</tbody>
  </table>
  ` : ''}

  <div class="footer">
    <p>This report was generated by SaccoUp on ${reportDate}. All amounts are in Uganda Shillings (UGX).</p>
    <p>This is a computer-generated report and does not require a signature.</p>
  </div>
</body>
</html>`;

    // Open in new window and trigger print (Save as PDF)
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Wait for content to render then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setExporting(false);
          setExportSuccess('PDF report generated! Use "Save as PDF" in the print dialog.');
          setTimeout(() => setExportSuccess(null), 5000);
        }, 500);
      };
      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (exporting) {
          printWindow.print();
          setExporting(false);
        }
      }, 2000);
    } else {
      setExporting(false);
      setExportSuccess('Pop-up blocked. Please allow pop-ups for this site.');
      setTimeout(() => setExportSuccess(null), 5000);
    }
  };

  // ===== CSV EXPORT =====
  const exportCsv = () => {
    const groupName = selectedGroup?.name || 'Group';
    let csv = '';

    if (activeReport === 'members' || activeReport === 'overview' || activeReport === 'balance') {
      if (isRoscaType) {
        csv = 'Member,Role,Total Contributions,Savings,Loan Balance,ROSCA Wins,ROSCA Won,ROSCA Savings,Combined Net Position\n';
        membersWithRosca.forEach(m => {
          csv += `"${m.full_name}","${m.role}",${m.total_contributions},${m.savings_balance},${m.loan_balance},${m.rosca_wins},${m.rosca_total_won},${m.rosca_savings},${m.combined_net}\n`;
        });
      } else {
        csv = 'Member,Role,Total Contributions,Savings,Loan Balance,Net Position\n';
        membersWithRosca.forEach(m => {
          csv += `"${m.full_name}","${m.role}",${m.total_contributions},${m.savings_balance},${m.loan_balance},${m.combined_net}\n`;
        });
      }
    } else if (activeReport === 'loans') {
      csv = 'Member,Amount,Purpose,Interest Rate,Term (months),Status,Date\n';
      loans.forEach(l => {
        csv += `"${l.member_name}",${l.amount},"${l.purpose}",${l.interest_rate},${l.repayment_period_months},"${l.status}","${l.created_at}"\n`;
      });
    } else if (activeReport === 'rosca') {
      csv = 'Cycle,Draw,Winner Slot,Winner Name,Draw Date,Amount Won,Savings,Paid Out,Deductions,Balance,Notes\n';
      cycles.forEach(cycle => {
        cycle.draws.forEach(draw => {
          csv += `"${cycle.cycle_name}",${draw.draw_number},${draw.winner_slot},"${draw.winner_name}","${draw.draw_date}",${draw.amount_received},${draw.savings || 0},${draw.paid_out || 0},${draw.deductions || 0},${draw.balance || 0},"${draw.notes || ''}"\n`;
        });
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupName.replace(/\s+/g, '_')}_${activeReport}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExportSuccess('CSV file downloaded!');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  // ROSCA aggregates from context
  const roscaGroupTotals = getGroupTotals();

  // Build per-member ROSCA stats for combined member statements
  const membersWithRosca = members.map(m => {
    const rs = getMemberStats(m.full_name);
    return {
      ...m,
      rosca_wins: rs.wins,
      rosca_total_won: rs.totalWon,
      rosca_savings: rs.totalSavings,
      rosca_deductions: rs.totalDeductions,
      rosca_balance: rs.totalBalance,
      combined_savings: m.savings_balance + rs.totalSavings,
      combined_net: (m.savings_balance - m.loan_balance) + rs.totalBalance,
    };
  });

  const allReports = [
    { id: 'overview', label: 'Group Overview', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
    { id: 'balance', label: 'Balance Sheet', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
    { id: 'members', label: 'Member Statements', icon: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z' },
    { id: 'loans', label: 'Loan Portfolio', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
    { id: 'rosca', label: 'ROSCA Cycles', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99' },
  ];

  // Hide ROSCA and loans tabs for non-ROSCA groups
  const reports = allReports.filter(r => {
    if (r.id === 'rosca' && !isRoscaType) return false;
    if (r.id === 'loans' && groupType === 'rosca') return false;
    return true;
  });

  if (!selectedGroup) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3>
        <p className="text-sm text-gray-500">Select or create a group to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Generate and export financial reports for {selectedGroup.name}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          <button
            onClick={generatePdfReport}
            disabled={exporting || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            )}
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            onClick={exportCsv}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            CSV
          </button>
        </div>
      </div>

      {/* Export success banner */}
      {exportSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {exportSuccess}
        </div>
      )}

      {/* Report Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {reports.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeReport === r.id ? 'bg-[#0066CC] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={r.icon} /></svg>
            {r.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl p-6 bg-gray-100 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-36 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-40 mb-6" />
            <div className="space-y-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#0066CC] to-[#004C99] rounded-xl p-6 text-white">
              <p className="text-sm text-blue-200">Total Group Savings</p>
              <p className="text-3xl font-bold mt-2">{formatUGX(totalSavings)}</p>
              <div className="mt-3 flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22" /></svg>
                <span className="text-xs text-emerald-300">{members.length} active member{members.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#00CC99] to-[#009973] rounded-xl p-6 text-white">
              <p className="text-sm text-emerald-200">Total Contributions</p>
              <p className="text-3xl font-bold mt-2">{formatUGX(totalContributions)}</p>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-emerald-200">{Math.round(stats?.collection_rate || 0)}% collection rate</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
              <p className="text-sm text-amber-200">Outstanding Loans</p>
              <p className="text-3xl font-bold mt-2">{formatUGX(totalLoans)}</p>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-amber-200">{activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Active Report Content */}
          {(activeReport === 'overview' || activeReport === 'balance') && (
            <>
              {/* Balance Sheet */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Balance Sheet</h3>
                {members.length > 0 || totalSavings > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {/* Assets */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Assets</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm text-gray-700">Total Savings</span>
                          <span className="text-sm font-bold text-[#0066CC]">{formatUGX(totalSavings)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                          <span className="text-sm text-gray-700">Loans Receivable</span>
                          <span className="text-sm font-bold text-amber-600">{formatUGX(totalLoans)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-t-2 border-gray-300">
                          <span className="text-sm font-bold text-gray-900">Total Assets</span>
                          <span className="text-sm font-bold text-gray-900">{formatUGX(totalSavings + totalLoans)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Liabilities & Equity */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Equity</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                          <span className="text-sm text-gray-700">Member Contributions</span>
                          <span className="text-sm font-bold text-emerald-600">{formatUGX(totalMemberContributions)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <span className="text-sm text-gray-700">Retained Earnings</span>
                          <span className="text-sm font-bold text-purple-600">{formatUGX(Math.max(0, totalSavings - totalMemberContributions))}</span>
                        </div>
                        <div className={`flex justify-between items-center p-3 rounded-lg border-t-2 border-gray-300 ${netPosition >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          <span className="text-sm font-bold text-gray-900">Net Position</span>
                          <span className={`text-sm font-bold ${netPosition >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatUGX(netPosition)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No financial data available yet.</p>
                  </div>
                )}
              </div>

              {/* Contribution Breakdown */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Contribution Breakdown</h3>
                {contributions.length > 0 ? (
                  <div className="grid sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-gray-50 text-center">
                      <p className="text-2xl font-bold text-gray-900">{contributions.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Total Transactions</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{confirmedContribs.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Confirmed</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 text-center">
                      <p className="text-2xl font-bold text-amber-600">{pendingContribs.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Pending</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 text-center">
                      <p className="text-2xl font-bold text-red-600">{failedContribs.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Failed</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <p className="text-sm">No contributions recorded yet.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Member Statements Tab */}
          {activeReport === 'members' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Member Statements</h3>
              <p className="text-xs text-gray-400 mb-4">{isRoscaType ? 'Combined SACCO contributions + ROSCA cycle earnings' : 'Member contribution summaries and account status'}</p>
              {membersWithRosca.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Member</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contributions</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Savings</th>
                        {isRoscaType && <><th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ROSCA Won</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ROSCA Savings</th></>}
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isRoscaType ? 'Loans' : 'Outstanding'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Net Position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {membersWithRosca.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#0066CC]/10 flex items-center justify-center text-xs font-bold text-[#0066CC]">
                                {m.full_name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-gray-900">{m.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">{m.role}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatUGX(m.total_contributions)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#0066CC] text-right">{formatUGX(m.savings_balance)}</td>
                          {isRoscaType && <><td className="px-4 py-3 text-sm font-medium text-emerald-600 text-right">
                            {m.rosca_total_won > 0 ? formatUGX(m.rosca_total_won) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-purple-600 text-right">
                            {m.rosca_savings > 0 ? formatUGX(m.rosca_savings) : <span className="text-gray-300">—</span>}
                          </td></>}
                          <td className="px-4 py-3 text-sm text-right">
                            {isRoscaType
                              ? (m.loan_balance > 0 ? <span className="text-amber-600">{formatUGX(m.loan_balance)}</span> : <span className="text-gray-300">—</span>)
                              : (m.loan_balance > 0 ? <span className="font-bold text-red-600">{formatUGX(m.loan_balance)}</span> : <span className="text-emerald-600">✅</span>)
                            }
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-right">
                            <span className={m.combined_net >= 0 ? 'text-[#00CC99]' : 'text-red-500'}>
                              {formatUGX(m.combined_net)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td className="px-4 py-3 text-sm text-gray-900" colSpan={2}>Total ({membersWithRosca.length} members)</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatUGX(totalMemberContributions)}</td>
                        <td className="px-4 py-3 text-sm text-[#0066CC] text-right">{formatUGX(totalSavings)}</td>
                        {isRoscaType && <><td className="px-4 py-3 text-sm text-emerald-600 text-right">{formatUGX(roscaGroupTotals.totalPaidOut)}</td>
                        <td className="px-4 py-3 text-sm text-purple-600 text-right">{formatUGX(roscaGroupTotals.totalSavings)}</td></>}
                        <td className={`px-4 py-3 text-sm text-right ${isRoscaType ? 'text-amber-600' : 'text-red-600 font-bold'}`}>{formatUGX(totalLoans)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={netPosition >= 0 ? 'text-[#00CC99]' : 'text-red-500'}>{formatUGX(netPosition + (isRoscaType ? roscaGroupTotals.totalSavings : 0))}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <p className="text-sm font-medium">No members found</p>
                  <p className="text-xs mt-1">Add members to your group to see their statements.</p>
                </div>
              )}
            </div>
          )}

          {/* Loan Portfolio Tab */}
          {activeReport === 'loans' && (
            <div className="space-y-6">
              {/* Loan Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-[#0066CC]">{activeLoans.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Active Loans</p>
                  <p className="text-xs font-medium text-[#0066CC] mt-0.5">{formatUGX(totalLoansDisbursed)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{pendingLoans.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Pending Approval</p>
                  <p className="text-xs font-medium text-amber-600 mt-0.5">{formatUGX(pendingLoans.reduce((s, l) => s + l.amount, 0))}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{completedLoans.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Completed</p>
                  <p className="text-xs font-medium text-emerald-600 mt-0.5">{formatUGX(completedLoans.reduce((s, l) => s + l.amount, 0))}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{defaultedLoans.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Defaulted</p>
                  <p className="text-xs font-medium text-red-600 mt-0.5">{formatUGX(defaultedLoans.reduce((s, l) => s + l.amount, 0))}</p>
                </div>
              </div>

              {/* Loan Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">All Loans</h3>
                {loans.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Member</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Purpose</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Term</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loans.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.member_name}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatUGX(l.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{l.purpose}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center">{l.interest_rate}%</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center">{l.repayment_period_months}mo</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                ['disbursed', 'completed'].includes(l.status) ? 'bg-emerald-100 text-emerald-700' :
                                ['pending', 'treasurer_approved', 'approved'].includes(l.status) ? 'bg-amber-100 text-amber-700' :
                                l.status === 'repaying' ? 'bg-blue-100 text-blue-700' :
                                ['defaulted', 'rejected'].includes(l.status) ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {getStatusLabel(l.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{l.created_at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium">No loans recorded</p>
                    <p className="text-xs mt-1">Loan applications will appear here once submitted.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ROSCA Cycles Tab */}
          {activeReport === 'rosca' && (
            <div className="space-y-6">
              {/* ROSCA Group Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-5 text-white">
                  <p className="text-xs text-purple-100">Total Paid Out</p>
                  <p className="text-2xl font-bold mt-1">{formatUGX(roscaGroupTotals.totalPaidOut)}</p>
                  <p className="text-xs text-purple-200 mt-1">{roscaGroupTotals.totalWinners} winners</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-5 text-white">
                  <p className="text-xs text-emerald-100">Total ROSCA Savings</p>
                  <p className="text-2xl font-bold mt-1">{formatUGX(roscaGroupTotals.totalSavings)}</p>
                  <p className="text-xs text-emerald-200 mt-1">across all cycles</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-5 text-white">
                  <p className="text-xs text-orange-100">Total Deductions</p>
                  <p className="text-2xl font-bold mt-1">{formatUGX(roscaGroupTotals.totalDeductions)}</p>
                  <p className="text-xs text-orange-200 mt-1">processing fees &amp; arrears</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-5 text-white">
                  <p className="text-xs text-blue-100">Total Cycles</p>
                  <p className="text-2xl font-bold mt-1">{cycles.length}</p>
                  <p className="text-xs text-blue-200 mt-1">{cycles.filter(c => c.status === 'active').length} active, {cycles.filter(c => c.status === 'completed').length} completed</p>
                </div>
              </div>

              {/* Per-cycle breakdown */}
              {cycles.map(cycle => {
                const cyclePaidOut = cycle.draws.reduce((s, d) => s + d.amount_received, 0);
                const cycleSavings = cycle.draws.reduce((s, d) => s + (d.savings || 0), 0);
                const cycleDeductions = cycle.draws.reduce((s, d) => s + (d.deductions || 0), 0);
                return (
                  <div key={cycle.cycle_number} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{cycle.cycle_name}</h3>
                        <p className="text-xs text-gray-500">{cycle.start_date} → {cycle.end_date || 'ongoing'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-right">
                        <div>
                          <p className="text-xs text-gray-400">Paid Out</p>
                          <p className="text-sm font-bold text-emerald-600">{formatUGX(cyclePaidOut)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Savings</p>
                          <p className="text-sm font-bold text-purple-600">{formatUGX(cycleSavings)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Deductions</p>
                          <p className="text-sm font-bold text-orange-600">{formatUGX(cycleDeductions)}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                          cycle.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          cycle.status === 'active' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{cycle.status}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Draw</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Winner</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Amount Won</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Savings</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Paid Out</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {cycle.draws.map((draw, idx) => (
                            <tr key={`${draw.draw_number}-${draw.winner_slot}-${idx}`} className="hover:bg-purple-50/30">
                              <td className="px-4 py-2 text-xs font-bold text-gray-600">D{draw.draw_number}-W{draw.winner_slot}</td>
                              <td className="px-4 py-2 text-xs text-gray-500">{draw.draw_date}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-800">{draw.winner_name || '—'}</td>
                              <td className="px-4 py-2 text-sm font-bold text-emerald-600 text-right">{formatUGX(draw.amount_received)}</td>
                              <td className="px-4 py-2 text-sm text-purple-600 text-right">{draw.savings ? formatUGX(draw.savings) : '—'}</td>
                              <td className="px-4 py-2 text-sm text-blue-600 text-right">{draw.paid_out ? formatUGX(draw.paid_out) : '—'}</td>
                              <td className="px-4 py-2 text-sm text-orange-600 text-right">{draw.deductions ? formatUGX(draw.deductions) : '—'}</td>
                              <td className="px-4 py-2 text-sm font-bold text-right">
                                {draw.balance !== undefined && draw.balance !== 0 ? (
                                  <span className={draw.balance > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                    {draw.balance > 0 ? '+' : ''}{formatUGX(draw.balance)}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-400 max-w-[120px] truncate">{draw.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                            <td colSpan={3} className="px-4 py-2 text-xs text-gray-700">Cycle {cycle.cycle_number} Totals ({cycle.draws.length} draws)</td>
                            <td className="px-4 py-2 text-xs text-emerald-700 text-right">{formatUGX(cyclePaidOut)}</td>
                            <td className="px-4 py-2 text-xs text-purple-700 text-right">{formatUGX(cycleSavings)}</td>
                            <td className="px-4 py-2 text-xs text-blue-700 text-right">{formatUGX(cycle.draws.reduce((s, d) => s + (d.paid_out || 0), 0))}</td>
                            <td className="px-4 py-2 text-xs text-orange-700 text-right">{formatUGX(cycleDeductions)}</td>
                            <td colSpan={2} className="px-4 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Per-member ROSCA summary (only members with wins) */}
              {membersWithRosca.filter(m => m.rosca_wins > 0).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Member ROSCA Summary</h3>
                  <p className="text-xs text-gray-400 mb-4">Members matched by name across all cycles</p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Member</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wins</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Won</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ROSCA Savings</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Net Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {membersWithRosca.filter(m => m.rosca_wins > 0).map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.full_name}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{m.rosca_wins}</span>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">{formatUGX(m.rosca_total_won)}</td>
                            <td className="px-4 py-3 text-sm text-purple-600 text-right">{formatUGX(m.rosca_savings)}</td>
                            <td className="px-4 py-3 text-sm text-orange-600 text-right">{m.rosca_deductions > 0 ? formatUGX(m.rosca_deductions) : '—'}</td>
                            <td className="px-4 py-3 text-sm font-bold text-right">
                              <span className={m.rosca_balance >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                {m.rosca_balance > 0 ? '+' : ''}{formatUGX(m.rosca_balance)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;

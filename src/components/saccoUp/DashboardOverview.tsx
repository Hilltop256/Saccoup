import React, { useEffect, useMemo, useState } from 'react';
import { useRoscaData } from '@/context/RoscaContext';
import * as ds from '@/lib/dataService';
import { supabase } from '@/lib/supabase';

/**
 * RoscaPaymentsDashboard
 *
 * Props:
 *  - selectedCycleId?: string  (optional; if not provided, uses first active cycle from context)
 *  - selectedDrawNumber?: number (optional; if not provided, uses first draw number)
 *
 * Behavior:
 *  - Loads members for the current group (via ds.listMembers)
 *  - Loads draws for the selected cycle (via ds.listRoscaDraws)
 *  - Loads draw contributions (ds.listDrawContributions)
 *  - Loads per-member expected/paid status from rosca_contribution_status (direct supabase query)
 *  - Maps and displays a table: Member | Expected | Paid (sum) | Shortfall | Status | Last payment info
 *  - Allows marking a member as paid (creates/updates rosca_contribution_status and optionally a rosca_draw_contributions record)
 */

interface Props {
  selectedCycleId?: string;
  selectedDrawNumber?: number;
  groupId?: string;
}

export default function RoscaPaymentsDashboard({ selectedCycleId, selectedDrawNumber, groupId }: Props) {
  const { cycles, refreshCycles } = useRoscaData();
  const [loading, setLoading] = useState(false);

  // UI state
  const [cycleId, setCycleId] = useState<string | undefined>(selectedCycleId);
  const [drawNumber, setDrawNumber] = useState<number | undefined>(selectedDrawNumber);
  const [members, setMembers] = useState<any[]>([]);
  const [drawContributions, setDrawContributions] = useState<any[]>([]);
  const [contributionStatusRows, setContributionStatusRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Determine default cycle/draw if not provided
  useEffect(() => {
    if (!cycleId) {
      const first = cycles && cycles.length > 0 ? cycles[0] : undefined;
      if (first) {
        setCycleId(first._db_id);
        // default to first draw number if available
        const firstDraw = first.draws && first.draws.length > 0 ? first.draws[0] : undefined;
        if (firstDraw) setDrawNumber(firstDraw.draw_number);
      }
    }
  }, [cycles, cycleId]);

  // When groupId not provided, try to infer from cycles
  useEffect(() => {
    if (!groupId && cycles && cycles.length > 0) {
      // cycles are per-group; we can't reliably infer groupId from cycles here without additional data.
      // If you have selectedGroupId in AppContext, pass it as prop to this component.
    }
  }, [cycles, groupId]);

  // Load members for the group (requires groupId)
  async function loadMembers(gid?: string) {
    if (!gid) {
      setMembers([]);
      return;
    }
    try {
      const { members: mdata } = await ds.listMembers(gid);
      setMembers(mdata || []);
    } catch (e: any) {
      console.error('Failed to load members', e);
      setError(e?.message || 'Failed to load members');
    }
  }

  // Load draw contributions (rosca_draw_contributions)
  async function loadDrawContributions(drawId?: string) {
    if (!drawId) {
      setDrawContributions([]);
      return;
    }
    try {
      const { data } = await ds.listDrawContributions(drawId);
      setDrawContributions(data || []);
    } catch (e: any) {
      console.error('Failed to load draw contributions', e);
      setError(e?.message || 'Failed to load draw contributions');
    }
  }

  // Load rosca_contribution_status rows for the cycle/draw
  async function loadContributionStatusRows(cId?: string, dNumber?: number) {
    if (!cId || dNumber == null) {
      setContributionStatusRows([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('rosca_contribution_status')
        .select('*')
        .eq('cycle_id', cId)
        .eq('draw_number', dNumber)
        .order('member_name', { ascending: true });

      if (error) throw error;
      setContributionStatusRows(data || []);
    } catch (e: any) {
      console.error('Failed to load contribution status rows', e);
      setError(e?.message || 'Failed to load contribution status rows');
    }
  }

  // Helper: find the draw id (UUID) for the selected cycle/draw number
  const selectedDrawDbId = useMemo(() => {
    if (!cycleId || drawNumber == null) return undefined;
    const cycle = cycles.find(c => c._db_id === cycleId);
    if (!cycle) return undefined;
    const draw = cycle.draws.find((d: any) => d.draw_number === drawNumber);
    return draw?._db_id;
  }, [cycleId, drawNumber, cycles]);

  // Combined load
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        // If groupId not provided, try to infer from cycles
        let gid = groupId;
        if (!gid && cycles && cycles.length > 0) {
          // cycles are grouped by group_id; pick the first cycle's group_id
          const first = cycles[0] as any;
          gid = (first as any)._group_id || (first as any).group_id || undefined;
        }

        await Promise.all([
          loadMembers(gid),
          loadContributionStatusRows(cycleId, drawNumber),
          loadDrawContributions(selectedDrawDbId),
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, drawNumber, selectedDrawDbId, refreshKey, cycles, groupId]);

  // Map members -> status row + contributions
  const memberPaymentMap = useMemo(() => {
    // Build a map of contributions by member_id (sum amounts)
    const contribByMember = new Map<string, { totalPaid: number; lastPaidAt?: string; methods: string[]; refs: string[] }>();
    (drawContributions || []).forEach((c: any) => {
      const mid = c.member_id;
      const prev = contribByMember.get(mid) || { totalPaid: 0, lastPaidAt: undefined, methods: [], refs: [] };
      prev.totalPaid += Number(c.amount || 0);
      if (c.paid_at) prev.lastPaidAt = c.paid_at;
      if (c.payment_method) prev.methods.push(c.payment_method);
      if (c.transaction_ref) prev.refs.push(c.transaction_ref);
      contribByMember.set(mid, prev);
    });

    // Build a map of expected/paid status rows keyed by member_id
    const statusByMember = new Map<string, any>();
    (contributionStatusRows || []).forEach((r: any) => {
      statusByMember.set(r.member_id, r);
    });

    // Compose final rows for display
    const rows = (members || []).map(m => {
      const statusRow = statusByMember.get(m.id);
      const contrib = contribByMember.get(m.id) || { totalPaid: 0, lastPaidAt: undefined, methods: [], refs: [] };
      const expected = statusRow ? Number(statusRow.expected_amount || 0) : undefined;
      const paidAmount = statusRow ? Number(statusRow.paid_amount || contrib.totalPaid || 0) : contrib.totalPaid || 0;
      const shortfall = expected != null ? Math.max(0, expected - paidAmount) : undefined;
      const status = statusRow ? statusRow.status : (paidAmount > 0 ? 'paid' : 'pending');

      return {
        memberId: m.id,
        memberName: m.full_name,
        phone: m.phone,
        expectedAmount: expected,
        paidAmount,
        shortfall,
        status,
        lastPaidAt: contrib.lastPaidAt,
        paymentMethods: contrib.methods,
        transactionRefs: contrib.refs,
        rawStatusRow: statusRow,
      };
    });

    // Also include any status rows for members not in the membership list (edge case)
    (contributionStatusRows || []).forEach((r: any) => {
      if (!rows.find((x: any) => x.memberId === r.member_id)) {
        rows.push({
          memberId: r.member_id,
          memberName: r.member_name,
          phone: undefined,
          expectedAmount: Number(r.expected_amount || 0),
          paidAmount: Number(r.paid_amount || 0),
          shortfall: Math.max(0, Number(r.expected_amount || 0) - Number(r.paid_amount || 0)),
          status: r.status,
          lastPaidAt: r.paid_at,
          paymentMethods: r.payment_method ? [r.payment_method] : [],
          transactionRefs: r.transaction_ref ? [r.transaction_ref] : [],
          rawStatusRow: r,
        });
      }
    });

    // Sort by memberName
    rows.sort((a: any, b: any) => (a.memberName || '').localeCompare(b.memberName || ''));
    return rows;
  }, [members, drawContributions, contributionStatusRows]);

  // Action: mark member as paid (creates/updates rosca_contribution_status and optionally rosca_draw_contributions)
  async function markMemberPaid(memberId: string, amount: number, paymentMethod?: string, transactionRef?: string) {
    if (!cycleId || drawNumber == null) {
      setError('Cycle or draw not selected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Upsert into rosca_contribution_status: find existing row
      const { data: existing, error: fetchErr } = await supabase
        .from('rosca_contribution_status')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('draw_number', drawNumber)
        .eq('member_id', memberId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (existing) {
        // Update paid_amount and status
        const newPaid = Number(existing.paid_amount || 0) + Number(amount || 0);
        const newStatus = newPaid >= Number(existing.expected_amount || 0) ? 'paid' : 'pending';
        const { error: updErr } = await supabase
          .from('rosca_contribution_status')
          .update({
            paid_amount: newPaid,
            status: newStatus,
            payment_method: paymentMethod || existing.payment_method || null,
            transaction_ref: transactionRef || existing.transaction_ref || null,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        // Insert new status row
        const { error: insErr } = await supabase
          .from('rosca_contribution_status')
          .insert({
            cycle_id: cycleId,
            draw_id: selectedDrawDbId || null,
            draw_number: drawNumber,
            member_id: memberId,
            member_name: (members.find(m => m.id === memberId) || {}).full_name || null,
            expected_amount: null,
            paid_amount: amount,
            status: 'paid',
            payment_method: paymentMethod || null,
            transaction_ref: transactionRef || null,
            paid_at: new Date().toISOString(),
          });
        if (insErr) throw insErr;
      }

      // Optionally create a rosca_draw_contributions record for audit/tracking
      if (selectedDrawDbId) {
        const { error: contribErr } = await supabase
          .from('rosca_draw_contributions')
          .insert({
            draw_id: selectedDrawDbId,
            member_id: memberId,
            member_name: (members.find(m => m.id === memberId) || {}).full_name || null,
            amount,
            payment_method: paymentMethod || 'cash',
            status: 'paid',
            transaction_ref: transactionRef || null,
            paid_at: new Date().toISOString(),
            recorded_by: null,
            notes: 'Marked paid via dashboard',
          });
        if (contribErr) console.warn('Failed to create rosca_draw_contributions record', contribErr);
      }

      // Refresh local data
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      console.error('Failed to mark member paid', e);
      setError(e?.message || 'Failed to mark member paid');
    } finally {
      setLoading(false);
    }
  }

  // UI: small helper to render currency
  function fmt(n?: number) {
    if (n == null) return '-';
    return Number(n).toLocaleString();
  }

  return (
    <div className="rosca-payments-dashboard">
      <h3>ROSCA Payments — Cycle / Draw status</h3>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Cycle</label>
        <select value={cycleId || ''} onChange={e => setCycleId(e.target.value || undefined)}>
          <option value="">Select cycle</option>
          {cycles.map(c => (
            <option key={c._db_id} value={c._db_id}>{c.cycle_name} (#{c.cycle_number})</option>
          ))}
        </select>

        <label style={{ marginLeft: 12, marginRight: 8 }}>Draw</label>
        <select value={drawNumber ?? ''} onChange={e => setDrawNumber(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Select draw</option>
          {(() => {
            const cycle = cycles.find(c => c._db_id === cycleId);
            if (!cycle) return null;
            // unique draw numbers
            const nums = Array.from(new Set(cycle.draws.map(d => d.draw_number))).sort((a, b) => a - b);
            return nums.map(n => <option key={n} value={n}>Draw {n}</option>);
          })()}
        </select>

        <button style={{ marginLeft: 12 }} onClick={() => setRefreshKey(k => k + 1)}>Refresh</button>
        <button style={{ marginLeft: 8 }} onClick={() => refreshCycles()}>Reload cycles</button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>Member</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Expected</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Paid</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Shortfall</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Status</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Last payment</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {memberPaymentMap.map(row => (
            <tr key={row.memberId}>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ fontWeight: 600 }}>{row.memberName}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{row.phone}</div>
              </td>
              <td style={{ textAlign: 'right' }}>{fmt(row.expectedAmount)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(row.paidAmount)}</td>
              <td style={{ textAlign: 'right' }}>{row.shortfall != null ? fmt(row.shortfall) : '-'}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: row.status === 'paid' ? '#dff0d8' : row.status === 'defaulted' ? '#f8d7da' : '#fff3cd',
                  color: '#333',
                  border: '1px solid #eee'
                }}>{row.status}</span>
              </td>
              <td style={{ textAlign: 'center' }}>{row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleString() : '-'}</td>
              <td style={{ textAlign: 'center' }}>
                <button onClick={() => {
                  const amt = Number(prompt('Amount paid (numbers only)', String(row.shortfall || row.expectedAmount || 0)) || 0);
                  if (!amt || amt <= 0) return;
                  const method = prompt('Payment method (cash, mobile money, bank)', 'cash') || 'cash';
                  const ref = prompt('Transaction reference (optional)', '') || undefined;
                  markMemberPaid(row.memberId, amt, method, ref);
                }}>Mark paid</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <strong>Notes</strong>
        <ul>
          <li>This view combines <code>rosca_draw_contributions</code> (individual payments recorded for a draw) and <code>rosca_contribution_status</code> (expected vs paid per member for a draw) to compute shortfalls and statuses.</li>
          <li>Use the "Mark paid" action to quickly record a payment and update the status row. For production, add validation, audit logging, and role checks.</li>
        </ul>
      </div>
    </div>
  );
}

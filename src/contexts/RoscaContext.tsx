import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MOCK_PBS_CYCLES, type RoscaCycle, type RoscaDraw } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import { useAppContext } from './AppContext';

// Extended types that carry Supabase UUIDs internally
export interface RoscaDrawWithId extends RoscaDraw {
  _db_id?: string;   // rosca_draws.id from Supabase
}
export interface RoscaCycleWithId extends Omit<RoscaCycle, 'draws'> {
  _db_id?: string;   // rosca_cycles.id from Supabase
  draws: RoscaDrawWithId[];
}

// Welfare tracking types
export interface RoscaWelfareItem {
  item: string;
  cost: number;
  date: string;
  recorded_by: string;
}

export interface RoscaWelfareWithId {
  _db_id?: string;
  cycle_id: string;
  draw_number: number;
  welfare_amount: number;
  amount_spent: number;
  amount_remaining: number;
  spent_items: RoscaWelfareItem[];
  reported_by?: string;
  report_date: string;
  notes?: string;
}

// Draw contribution types
export interface RoscaDrawContribution {
  _db_id?: string;
  draw_id: string;
  member_id: string;
  member_name: string;
  contribution_type: 'monthly' | 'welfare';
  amount: number;
  payment_method: string;
  status: 'pending' | 'confirmed' | 'failed';
  transaction_ref?: string;
  paid_at?: string;
  notes?: string;
}

interface RoscaContextType {
  cycles: RoscaCycleWithId[];
  setCycles: React.Dispatch<React.SetStateAction<RoscaCycleWithId[]>>;
  loading: boolean;
  updateDraw: (cycleNumber: number, updatedDraw: RoscaDraw) => Promise<void>;
  addDraw: (cycleNumber: number, newDraw: RoscaDraw) => Promise<void>;
  refreshCycles: () => Promise<void>;
  createCycle: (cycleData: Partial<RoscaCycle>) => Promise<RoscaCycleWithId | null>;
  getMemberStats: (memberName: string) => {
    totalWon: number;
    totalSavings: number;
    totalDeductions: number;
    totalPaidOut: number;
    totalBalance: number;
    wins: number;
  };
  getGroupTotals: () => {
    totalPaidOut: number;
    totalSavings: number;
    totalDeductions: number;
    totalWinners: number;
  };
  // Welfare functions
  welfare: RoscaWelfareWithId[];
  loadWelfare: (cycleId: string) => Promise<void>;
  createWelfare: (cycleId: string, drawNumber: number, amount?: number) => Promise<void>;
  addWelfareSpending: (welfareId: string, item: string, cost: number, recordedBy: string) => Promise<void>;
  // Draw contributions
  drawContributions: Record<string, RoscaDrawContribution[]>;
  loadDrawContributions: (cycleId: string, drawNumber: number) => Promise<void>;
  recordDrawContribution: (params: {
    drawId: string;
    memberId: string;
    memberName: string;
    amount: number;
    contributionType?: 'monthly' | 'welfare';
    paymentMethod?: string;
    status?: 'pending' | 'confirmed' | 'failed';
  }) => Promise<void>;
  updateDrawContributionStatus: (contributionId: string, status: 'pending' | 'confirmed' | 'failed') => Promise<void>;
}

const RoscaContext = createContext<RoscaContextType | undefined>(undefined);

export const useRoscaData = () => {
  const context = useContext(RoscaContext);
  if (!context) throw new Error('useRoscaData must be used within RoscaProvider');
  return context;
};

interface RoscaProviderProps { children: ReactNode; }

// Map Supabase rows → internal format (preserving UUIDs)
function mapSupabaseToCycles(
  dbCycles: ds.RoscaCycleRow[],
  dbDraws: Record<string, ds.RoscaDrawRow[]>
): RoscaCycleWithId[] {
  return dbCycles.map(c => ({
    _db_id: c.id,
    cycle_number: c.cycle_number,
    cycle_name: c.cycle_name,
    status: c.status as 'completed' | 'active' | 'upcoming',
    start_date: c.start_date,
    end_date: c.end_date || undefined,
    total_draws: c.total_draws,
    pot_amount_per_draw: Number(c.pot_amount_per_draw),
    draws: (dbDraws[c.id] || []).map(d => ({
      _db_id: d.id,
      draw_number: d.draw_number,
      winner_slot: d.winner_slot as '1' | '2',
      winner_name: d.winner_name || '',
      winner_id: d.winner_id || undefined,
      amount_received: Number(d.amount_received),
      draw_date: d.draw_date,
      savings: d.savings != null ? Number(d.savings) : undefined,
      paid_out: d.paid_out != null ? Number(d.paid_out) : undefined,
      deductions: d.deductions != null ? Number(d.deductions) : undefined,
      balance: d.balance != null ? Number(d.balance) : undefined,
      status: d.status as 'won' | 'pending' | 'skipped' | 'forfeited',
      notes: d.notes || undefined,
    })),
  }));
}

export const RoscaProvider: React.FC<RoscaProviderProps> = ({ children }) => {
  const { selectedGroupId } = useAppContext();
  const [cycles, setCycles] = useState<RoscaCycleWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [welfare, setWelfare] = useState<RoscaWelfareWithId[]>([]);
  const [drawContributions, setDrawContributions] = useState<Record<string, RoscaDrawContribution[]>>({});

  // ── Load from Supabase ────────────────────────────────────────────────────
  const loadCycles = useCallback(async () => {
    if (!selectedGroupId) {
      // No group yet — show mock data so UI is never empty
      setCycles(MOCK_PBS_CYCLES.map(c => ({ ...c, _db_id: undefined, draws: c.draws.map(d => ({ ...d, _db_id: undefined })) })));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { cycles: dbCycles } = await ds.listRoscaCycles(selectedGroupId);

      if (dbCycles && dbCycles.length > 0) {
        const drawsMap: Record<string, ds.RoscaDrawRow[]> = {};
        for (const c of dbCycles) {
          const { draws } = await ds.listRoscaDraws(c.id);
          if (draws) drawsMap[c.id] = draws;
        }
        setCycles(mapSupabaseToCycles(dbCycles, drawsMap));
      } else {
        // No data yet — will trigger seed
        setCycles([]);
      }
    } catch (e) {
      console.error('Failed to load ROSCA cycles:', e);
      setCycles(MOCK_PBS_CYCLES.map(c => ({ ...c, _db_id: undefined, draws: c.draws.map(d => ({ ...d, _db_id: undefined })) })));
    }
    setLoading(false);
  }, [selectedGroupId]);

  // ── Seed canonical data to Supabase (one-time per group) ─────────────────
  const seedToSupabase = useCallback(async () => {
    if (!selectedGroupId || seeding) return;
    setSeeding(true);
    try {
      // Double-check still empty
      const { cycles: existing } = await ds.listRoscaCycles(selectedGroupId);
      if (existing && existing.length > 0) {
        await loadCycles();
        setSeeding(false);
        return;
      }

      for (const cycle of MOCK_PBS_CYCLES) {
        const { cycle: newCycle } = await ds.createRoscaCycle({
          group_id: selectedGroupId,
          cycle_number: cycle.cycle_number,
          cycle_name: cycle.cycle_name,
          status: cycle.status,
          start_date: cycle.start_date,
          end_date: cycle.end_date,
          total_draws: cycle.total_draws,
          pot_amount_per_draw: cycle.pot_amount_per_draw,
          member_count: cycle.draws.length / 2,
          security_deposit: cycle.cycle_number === 3 ? 500000 : 0,
        });

        if (newCycle) {
          for (const draw of cycle.draws) {
            await ds.createRoscaDraw({
              cycle_id: newCycle.id,
              draw_number: draw.draw_number,
              winner_slot: draw.winner_slot,
              winner_name: draw.winner_name || undefined,
              amount_received: draw.amount_received,
              draw_date: draw.draw_date,
              savings: draw.savings,
              paid_out: draw.paid_out,
              deductions: draw.deductions,
              balance: draw.balance,
              status: draw.status,
              notes: draw.notes,
            });
          }
        }
      }
      await loadCycles();
    } catch (e) {
      console.error('Failed to seed ROSCA data:', e);
      // Fall back to mock data with no UUIDs
      setCycles(MOCK_PBS_CYCLES.map(c => ({ ...c, _db_id: undefined, draws: c.draws.map(d => ({ ...d, _db_id: undefined })) })));
    }
    setSeeding(false);
  }, [selectedGroupId, seeding, loadCycles]);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  // Trigger seed when load completes with empty result
  useEffect(() => {
    if (!loading && cycles.length === 0 && selectedGroupId && !seeding) {
      seedToSupabase();
    }
  }, [loading, cycles.length, selectedGroupId, seeding, seedToSupabase]);

  const refreshCycles = useCallback(async () => { await loadCycles(); }, [loadCycles]);

  // ── Create new cycle ────────────────────────────────────────────────────────
  const createCycle = useCallback(async (cycleData: Partial<RoscaCycle>): Promise<RoscaCycleWithId | null> => {
    if (!selectedGroupId) return null;
    
    try {
      const { cycle } = await ds.createRoscaCycle({
        group_id: selectedGroupId,
        cycle_number: cycleData.cycle_number || cycles.length + 1,
        cycle_name: cycleData.cycle_name || `Cycle ${cycleData.cycle_number || cycles.length + 1}`,
        status: cycleData.status || 'upcoming',
        start_date: cycleData.start_date || new Date().toISOString().split('T')[0],
        end_date: cycleData.end_date,
        total_draws: cycleData.total_draws || 10,
        pot_amount_per_draw: cycleData.pot_amount_per_draw || 5000000,
        member_count: cycleData.draws?.length || 20,
        security_deposit: cycleData.cycle_number === 4 ? 500000 : 0,
        notes: cycleData.notes,
      });

      if (cycle) {
        await loadCycles();
        return {
          _db_id: cycle.id,
          cycle_number: cycle.cycle_number,
          cycle_name: cycle.cycle_name,
          status: cycle.status as 'completed' | 'active' | 'upcoming',
          start_date: cycle.start_date,
          end_date: cycle.end_date || undefined,
          total_draws: cycle.total_draws,
          pot_amount_per_draw: Number(cycle.pot_amount_per_draw),
          draws: [],
        };
      }
    } catch (e) {
      console.error('Failed to create cycle:', e);
    }
    return null;
  }, [selectedGroupId, cycles.length, loadCycles]);

  // ── Welfare tracking functions ──────────────────────────────────────────────
  const loadWelfare = useCallback(async (cycleId: string) => {
    try {
      const { welfare: w } = await ds.listRoscaWelfare(cycleId);
      if (w) {
        setWelfare(w.map((item: ds.RoscaWelfareRow) => ({
          _db_id: item.id,
          cycle_id: item.cycle_id,
          draw_number: item.draw_number,
          welfare_amount: Number(item.welfare_amount),
          amount_spent: Number(item.amount_spent),
          amount_remaining: Number(item.welfare_amount) - Number(item.amount_spent),
          spent_items: (item.spent_items as RoscaWelfareItem[]) || [],
          reported_by: item.reported_by || undefined,
          report_date: item.report_date,
          notes: item.notes || undefined,
        })));
      }
    } catch (e) {
      console.error('Failed to load welfare:', e);
    }
  }, []);

  const createWelfare = useCallback(async (cycleId: string, drawNumber: number, amount = 50000) => {
    try {
      await ds.createRoscaWelfare({
        cycle_id: cycleId,
        draw_number: drawNumber,
        welfare_amount: amount,
      });
      await loadWelfare(cycleId);
    } catch (e) {
      console.error('Failed to create welfare:', e);
    }
  }, [loadWelfare]);

  const addWelfareSpending = useCallback(async (welfareId: string, item: string, cost: number, recordedBy: string) => {
    try {
      await ds.addRoscaWelfareItem({
        welfare_id: welfareId,
        item,
        cost,
        recorded_by: recordedBy,
      });
      // Reload welfare for the current cycle
      const currentCycle = cycles.find(c => c.status === 'active' || c.status === 'upcoming');
      if (currentCycle?._db_id) {
        await loadWelfare(currentCycle._db_id);
      }
    } catch (e) {
      console.error('Failed to add welfare spending:', e);
    }
  }, [cycles, loadWelfare]);

  // ── Draw contribution functions ─────────────────────────────────────────────
  const loadDrawContributions = useCallback(async (cycleId: string, drawNumber: number) => {
    try {
      const key = `${cycleId}-${drawNumber}`;
      const { contributions } = await ds.listRoscaDrawContributionsByCycle(cycleId, drawNumber);
      if (contributions) {
        setDrawContributions(prev => ({
          ...prev,
          [key]: contributions.map((c: ds.RoscaDrawContributionRow) => ({
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
            notes: c.notes || undefined,
          })),
        }));
      }
    } catch (e) {
      console.error('Failed to load draw contributions:', e);
    }
  }, []);

  const recordDrawContribution = useCallback(async (params: {
    drawId: string;
    memberId: string;
    memberName: string;
    amount: number;
    contributionType?: 'monthly' | 'welfare';
    paymentMethod?: string;
    status?: 'pending' | 'confirmed' | 'failed';
  }) => {
    try {
      await ds.recordRoscaDrawContribution({
        draw_id: params.drawId,
        member_id: params.memberId,
        member_name: params.memberName,
        contribution_type: params.contributionType || 'monthly',
        amount: params.amount,
        payment_method: params.paymentMethod || 'cash',
        status: params.status || 'pending',
      });
      // Reload contributions for the draw
      const cycle = cycles.find(c => c.draws.some(d => d._db_id === params.drawId));
      if (cycle) {
        const draw = cycle.draws.find(d => d._db_id === params.drawId);
        if (draw && cycle._db_id) {
          await loadDrawContributions(cycle._db_id, draw.draw_number);
        }
      }
    } catch (e) {
      console.error('Failed to record draw contribution:', e);
    }
  }, [cycles, loadDrawContributions]);

  const updateDrawContributionStatus = useCallback(async (contributionId: string, status: 'pending' | 'confirmed' | 'failed') => {
    try {
      await ds.updateRoscaDrawContributionStatus(contributionId, status);
      // Reload contributions - need to find the right draw
      for (const cycle of cycles) {
        for (const draw of cycle.draws) {
          const key = `${cycle._db_id}-${draw.draw_number}`;
          const contrib = drawContributions[key]?.find(c => c._db_id === contributionId);
          if (contrib && cycle._db_id) {
            await loadDrawContributions(cycle._db_id, draw.draw_number);
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to update contribution status:', e);
    }
  }, [cycles, drawContributions, loadDrawContributions]);

  // ── Update draw — persists to Supabase then reloads ────────────────────
  const updateDraw = useCallback(async (cycleNumber: number, updatedDraw: RoscaDraw) => {
    // Optimistic local update first (instant UI feedback)
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== cycleNumber) return c;
      return {
        ...c,
        draws: c.draws.map(d =>
          d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
            ? { ...updatedDraw, _db_id: d._db_id }
            : d
        ),
      };
    }));

    // Persist to Supabase
    if (!selectedGroupId) return;
    try {
      const cycle = cycles.find(c => c.cycle_number === cycleNumber);
      const draw = cycle?.draws.find(
        d => d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
      );

      if (draw?._db_id) {
        // Row exists — update it
        await ds.updateRoscaDraw(draw._db_id, {
          winner_name: updatedDraw.winner_name,
          winner_id: updatedDraw.winner_id,
          amount_received: updatedDraw.amount_received,
          draw_date: updatedDraw.draw_date,
          savings: updatedDraw.savings ?? null,
          paid_out: updatedDraw.paid_out ?? null,
          deductions: updatedDraw.deductions ?? null,
          balance: updatedDraw.balance ?? null,
          status: updatedDraw.status,
          notes: updatedDraw.notes ?? null,
        });
      } else if (cycle?._db_id) {
        // Row doesn't exist yet (new draw added to existing cycle) — insert it
        await ds.createRoscaDraw({
          cycle_id: cycle._db_id,
          draw_number: updatedDraw.draw_number,
          winner_slot: updatedDraw.winner_slot,
          winner_name: updatedDraw.winner_name || undefined,
          amount_received: updatedDraw.amount_received,
          draw_date: updatedDraw.draw_date,
          savings: updatedDraw.savings,
          paid_out: updatedDraw.paid_out,
          deductions: updatedDraw.deductions,
          balance: updatedDraw.balance,
          status: updatedDraw.status,
          notes: updatedDraw.notes,
        });
        // Reload to get the new UUID
        await loadCycles();
      }
    } catch (e) {
      console.error('Failed to persist draw update:', e);
    }
  }, [cycles, selectedGroupId, loadCycles]);

  // ── Add new draw — persists both slots to Supabase ───────────────────────
  const addDraw = useCallback(async (cycleNumber: number, newDraw: RoscaDraw) => {
    const cycle = cycles.find(c => c.cycle_number === cycleNumber);
    if (!cycle) return;

    const maxNum = Math.max(0, ...cycle.draws.map(d => d.draw_number));
    const nextNum = maxNum + 1;
    const draw1: RoscaDrawWithId = { ...newDraw, draw_number: nextNum, winner_slot: '1', _db_id: undefined };
    const draw2: RoscaDrawWithId = { ...newDraw, draw_number: nextNum, winner_slot: '2', _db_id: undefined };

    // Optimistic update
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== cycleNumber) return c;
      return { ...c, draws: [...c.draws, draw1, draw2], total_draws: c.total_draws + 2 };
    }));

    // Persist to Supabase
    if (cycle._db_id) {
      try {
        for (const slot of ['1', '2'] as const) {
          const d = slot === '1' ? draw1 : draw2;
          await ds.createRoscaDraw({
            cycle_id: cycle._db_id,
            draw_number: nextNum,
            winner_slot: slot,
            winner_name: d.winner_name || undefined,
            amount_received: d.amount_received,
            draw_date: d.draw_date,
            savings: d.savings,
            paid_out: d.paid_out,
            deductions: d.deductions,
            balance: d.balance,
            status: d.status,
            notes: d.notes,
          });
        }
        // Reload to populate _db_ids for the new draws
        await loadCycles();
      } catch (e) {
        console.error('Failed to persist new draw:', e);
      }
    }
  }, [cycles, loadCycles]);

  // ── Aggregate helpers ─────────────────────────────────────────────────────
  const getMemberStats = useCallback((memberName: string) => {
    let totalWon = 0, totalSavings = 0, totalDeductions = 0,
        totalPaidOut = 0, totalBalance = 0, wins = 0;

    cycles.forEach(cycle => {
      cycle.draws.forEach(draw => {
        if (draw.winner_name === memberName) {
          wins++;
          totalWon       += draw.amount_received;
          totalSavings   += draw.savings    || 0;
          totalDeductions += draw.deductions || 0;
          totalPaidOut   += draw.paid_out   || 0;
          totalBalance   += draw.balance    || 0;
        }
      });
    });
    return { totalWon, totalSavings, totalDeductions, totalPaidOut, totalBalance, wins };
  }, [cycles]);

  const getGroupTotals = useCallback(() => {
    let totalPaidOut = 0, totalSavings = 0, totalDeductions = 0, totalWinners = 0;

    cycles.forEach(cycle => {
      cycle.draws.forEach(draw => {
        if (draw.winner_name) {
          totalWinners++;
          totalPaidOut    += draw.amount_received;
          totalSavings    += draw.savings    || 0;
          totalDeductions += draw.deductions || 0;
        }
      });
    });
    return { totalPaidOut, totalSavings, totalDeductions, totalWinners };
  }, [cycles]);

  return (
    <RoscaContext.Provider value={{
      cycles,
      setCycles,
      loading,
      updateDraw,
      addDraw,
      refreshCycles,
      createCycle,
      getMemberStats,
      getGroupTotals,
      welfare,
      loadWelfare,
      createWelfare,
      addWelfareSpending,
      drawContributions,
      loadDrawContributions,
      recordDrawContribution,
      updateDrawContributionStatus,
    }}>
      {children}
    </RoscaContext.Provider>
  );
};

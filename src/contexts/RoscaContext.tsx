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

interface RoscaContextType {
  cycles: RoscaCycleWithId[];
  setCycles: React.Dispatch<React.SetStateAction<RoscaCycleWithId[]>>;
  loading: boolean;
  updateDraw: (cycleNumber: number, updatedDraw: RoscaDraw) => Promise<void>;
  addDraw: (cycleNumber: number, newDraw: RoscaDraw) => Promise<void>;
  refreshCycles: () => Promise<void>;
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
    member_count: c.member_count,
    security_deposit: c.security_deposit != null ? Number(c.security_deposit) : undefined,
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
      getMemberStats,
      getGroupTotals,
    }}>
      {children}
    </RoscaContext.Provider>
  );
};

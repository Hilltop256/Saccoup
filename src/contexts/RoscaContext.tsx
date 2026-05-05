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
  contributionStatuses: ds.RoscaContributionStatusRow[];
  cycles: RoscaCycleWithId[];
  setCycles: React.Dispatch<React.SetStateAction<RoscaCycleWithId[]>>;
  loading: boolean;
  isMockData: boolean;
  updateDraw: (cycleNumber: number, updatedDraw: RoscaDraw) => Promise<void>;
  addDraw: (cycleNumber: number, newDraw: RoscaDraw) => Promise<void>;
  createCycle: (params: { 
    cycle_name: string; 
    start_date: string; 
    total_draws: number; 
    pot_amount_per_draw: number; 
    member_count: number; 
    security_deposit: number 
  }) => Promise<void>;
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
  const [isMockData, setIsMockData] = useState(false);
  const [contributionStatuses, setContributionStatuses] = useState<ds.RoscaContributionStatusRow[]>([]);

  // ── Load from Supabase ────────────────────────────────────────────────────
  const loadCycles = useCallback(async () => {
    if (!selectedGroupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { cycles: dbCycles } = await ds.listRoscaCycles(selectedGroupId);

      if (dbCycles && dbCycles.length > 0) {
        const drawsMap: Record<string, ds.RoscaDrawRow[]> = {};
        let allStatuses: ds.RoscaContributionStatusRow[] = [];

        for (const c of dbCycles) {
          // Fetch draws
          const { draws } = await ds.listRoscaDraws(c.id);
          if (draws) drawsMap[c.id] = draws;

          // Fetch contribution statuses
          const { statuses } = await ds.listRoscaContributionStatuses(c.id);
          if (statuses) allStatuses = [...allStatuses, ...statuses];
        }

        setCycles(mapSupabaseToCycles(dbCycles, drawsMap));
        setContributionStatuses(allStatuses);
        setIsMockData(false);
      } else {
        // Fallback to Mock Data if no database cycles exist for this group
        setCycles(MOCK_PBS_CYCLES.map(c => ({ 
          ...c, 
          _db_id: undefined, 
          draws: c.draws.map(d => ({ ...d, _db_id: undefined })) 
        })));
        setContributionStatuses([]);
        setIsMockData(true);
      }
    } catch (e) {
      console.error('Failed to load ROSCA data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const refreshCycles = useCallback(async () => {
    await loadCycles();
  }, [loadCycles]);

  // ── Update draw — persists to Supabase then reloads ────────────────────
  const updateDraw = useCallback(async (cycleNumber: number, updatedDraw: RoscaDraw) => {
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

    if (!selectedGroupId) return;
    try {
      const cycle = cycles.find(c => c.cycle_number === cycleNumber);
      const draw = cycle?.draws.find(
        d => d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
      );

      if (draw?._db_id) {
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
        await loadCycles();
      }
    } catch (e) {
      console.error('Failed to persist draw update:', e);
    }
  }, [cycles, selectedGroupId, loadCycles]);

  // ── Add new draw — persists both slots to Supabase ───────────────────────
  const addDraw = useCallback(async (cycleNumber: number, newDraw: RoscaDraw) => {
    const cycle = cycles.find(c => c.cycle_number === cycleNumber);
    if (!cycle || !cycle._db_id) return;

    const maxNum = Math.max(0, ...cycle.draws.map(d => d.draw_number));
    const nextNum = maxNum + 1;

    try {
      for (const slot of ['1', '2'] as const) {
        await ds.createRoscaDraw({
          cycle_id: cycle._db_id,
          draw_number: nextNum,
          winner_slot: slot,
          winner_name: newDraw.winner_name || undefined,
          amount_received: newDraw.amount_received,
          draw_date: newDraw.draw_date,
          savings: newDraw.savings,
          paid_out: newDraw.paid_out,
          deductions: newDraw.deductions,
          balance: newDraw.balance,
          status: newDraw.status,
          notes: newDraw.notes,
        });
      }
      await loadCycles();
    } catch (e) {
      console.error('Failed to persist new draw:', e);
    }
  }, [cycles, loadCycles]);

  // ── Create new cycle ─────────────────────────────────────────────────────
  const createCycle = useCallback(async (params: { 
    cycle_name: string; 
    start_date: string; 
    total_draws: number; 
    pot_amount_per_draw: number; 
    member_count: number; 
    security_deposit: number 
  }) => {
    if (!selectedGroupId) throw new Error('No group selected.');
    const nextNumber = Math.max(0, ...cycles.map(c => c.cycle_number)) + 1;

    const { cycle } = await ds.createRoscaCycle({
      group_id: selectedGroupId,
      cycle_number: nextNumber,
      cycle_name: params.cycle_name,
      status: 'upcoming',
      start_date: params.start_date,
      total_draws: params.total_draws,
      pot_amount_per_draw: params.pot_amount_per_draw,
      member_count: params.member_count,
      security_deposit: params.security_deposit,
    });

    if (cycle) {
      for (let d = 1; d <= params.total_draws; d++) {
        for (const slot of ['1', '2'] as const) {
          await ds.createRoscaDraw({
            cycle_id: cycle.id,
            draw_number: d,
            winner_slot: slot,
            winner_name: undefined,
            amount_received: params.pot_amount_per_draw,
            draw_date: params.start_date,
            savings: params.security_deposit || 0,
            paid_out: 0,
            deductions: 0,
            balance: 0,
            status: 'pending',
            notes: slot === '1' ? `Draw ${d} of ${params.total_draws}` : undefined,
          });
        }
      }
      await loadCycles();
    }
  }, [selectedGroupId, cycles, loadCycles]);

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
      contributionStatuses, // Included this to fix dashboard "Zeros"
      loading,
      isMockData,
      updateDraw,
      addDraw,
      createCycle,
      refreshCycles,
      getMemberStats,
      getGroupTotals,
    }}>
      {children}
    </RoscaContext.Provider>
  );
};

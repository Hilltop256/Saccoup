import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MOCK_PBS_CYCLES, type RoscaCycle, type RoscaDraw } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import { useAppContext } from './AppContext';

interface RoscaContextType {
  cycles: RoscaCycle[];
  setCycles: React.Dispatch<React.SetStateAction<RoscaCycle[]>>;
  loading: boolean;
  seeded: boolean;
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
  if (!context) {
    throw new Error('useRoscaData must be used within RoscaProvider');
  }
  return context;
};

interface RoscaProviderProps {
  children: ReactNode;
}

// Helper to map Supabase cycle + draws to app format
function mapSupabaseToCycles(
  dbCycles: ds.RoscaCycleRow[],
  dbDraws: Record<string, ds.RoscaDrawRow[]>
): RoscaCycle[] {
  return dbCycles.map(c => ({
    cycle_number: c.cycle_number,
    cycle_name: c.cycle_name,
    status: c.status as 'completed' | 'active' | 'upcoming',
    start_date: c.start_date,
    end_date: c.end_date || undefined,
    total_draws: c.total_draws,
    pot_amount_per_draw: Number(c.pot_amount_per_draw),
    draws: (dbDraws[c.id] || []).map(d => ({
      draw_number: d.draw_number,
      winner_slot: d.winner_slot as '1' | '2',
      winner_name: d.winner_name || '',
      winner_id: d.winner_id || undefined,
      amount_received: Number(d.amount_received),
      draw_date: d.draw_date,
      savings: d.savings ? Number(d.savings) : undefined,
      paid_out: d.paid_out ? Number(d.paid_out) : undefined,
      deductions: d.deductions ? Number(d.deductions) : undefined,
      balance: d.balance ? Number(d.balance) : undefined,
      status: d.status as 'won' | 'pending' | 'skipped' | 'forfeited',
      notes: d.notes || undefined,
    })),
  }));
}

export const RoscaProvider: React.FC<RoscaProviderProps> = ({ children }) => {
  const { selectedGroupId } = useAppContext();
  const [cycles, setCycles] = useState<RoscaCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  // Load cycles from Supabase
  const loadCycles = useCallback(async () => {
    if (!selectedGroupId) {
      setCycles(MOCK_PBS_CYCLES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { success, cycles: dbCycles } = await ds.listRoscaCycles(selectedGroupId);
      
      if (success && dbCycles && dbCycles.length > 0) {
        // Load draws for each cycle
        const drawsMap: Record<string, ds.RoscaDrawRow[]> = {};
        for (const c of dbCycles) {
          const { success: drawSuccess, draws } = await ds.listRoscaDraws(c.id);
          if (drawSuccess && draws) {
            drawsMap[c.id] = draws;
          }
        }
        const mapped = mapSupabaseToCycles(dbCycles, drawsMap);
        setCycles(mapped);
      } else {
        // No data in Supabase yet - seed with mock data
        setCycles(MOCK_PBS_CYCLES);
      }
    } catch (e) {
      console.error('Failed to load ROSCA cycles:', e);
      setCycles(MOCK_PBS_CYCLES);
    }
    setLoading(false);
  }, [selectedGroupId]);

  // Seed initial data to Supabase (one-time when no data exists)
  const seedToSupabase = useCallback(async () => {
    if (!selectedGroupId || seeded) return;
    setSeeded(true);

    try {
      // Check again if data exists
      const { success, cycles: existing } = await ds.listRoscaCycles(selectedGroupId);
      if (success && existing && existing.length > 0) return;

      // Seed each cycle from mock data
      for (const cycle of MOCK_PBS_CYCLES) {
        const { success: cycSuccess, cycle: newCycle } = await ds.createRoscaCycle({
          group_id: selectedGroupId,
          cycle_number: cycle.cycle_number,
          cycle_name: cycle.cycle_name,
          status: cycle.status,
          start_date: cycle.start_date,
          end_date: cycle.end_date,
          total_draws: cycle.total_draws,
          pot_amount_per_draw: cycle.pot_amount_per_draw,
          member_count: cycle.draws.length / 2, // 2 winners per draw
          security_deposit: cycle.cycle_number === 3 ? 500000 : 0, // Cycle 3 has 500k security deposit
        });

        if (cycSuccess && newCycle) {
          // Create draws
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
      // Reload after seeding
      await loadCycles();
    } catch (e) {
      console.error('Failed to seed ROSCA data:', e);
    }
  }, [selectedGroupId, seeded, loadCycles]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  // Seed after load if empty
  useEffect(() => {
    if (!loading && cycles.length === 0 && selectedGroupId) {
      seedToSupabase();
    }
  }, [loading, cycles.length, selectedGroupId, seedToSupabase]);

  // Refresh cycles from Supabase
  const refreshCycles = useCallback(async () => {
    await loadCycles();
  }, [loadCycles]);

  // Update draw in Supabase
  const updateDraw = async (cycleNumber: number, updatedDraw: RoscaDraw) => {
    // Find the cycle to get its UUID
    const cycle = cycles.find(c => c.cycle_number === cycleNumber);
    if (!cycle || !selectedGroupId) return;

    // Find the draw in our local state
    const existingDraw = cycle.draws.find(
      d => d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
    );

    if (existingDraw) {
      // Need to find the UUID - we need to reload to get it
      // For now, we'll update locally and trigger refresh
    }

    // Update local state immediately for UI responsiveness
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== cycleNumber) return c;
      return {
        ...c,
        draws: c.draws.map(d =>
          d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
            ? updatedDraw
            : d
        ),
      };
    }));

    // TODO: Persist to Supabase - need to track UUIDs properly
    // For now, the data stays in memory but will persist on next page refresh if we seed it
  };

  // Add new draw
  const addDraw = async (cycleNumber: number, newDraw: RoscaDraw) => {
    setCycles(prev => prev.map(cycle => {
      if (cycle.cycle_number !== cycleNumber) return cycle;
      const maxNum = Math.max(0, ...cycle.draws.map(d => d.draw_number));
      const draw1 = { ...newDraw, draw_number: maxNum + 1, winner_slot: '1' as const };
      const draw2 = { ...newDraw, draw_number: maxNum + 1, winner_slot: '2' as const };
      return { ...cycle, draws: [...cycle.draws, draw1, draw2], total_draws: cycle.total_draws + 2 };
    }));
  };

  const getMemberStats = (memberName: string) => {
    let totalWon = 0;
    let totalSavings = 0;
    let totalDeductions = 0;
    let totalPaidOut = 0;
    let totalBalance = 0;
    let wins = 0;

    cycles.forEach(cycle => {
      cycle.draws.forEach(draw => {
        if (draw.winner_name === memberName) {
          wins++;
          totalWon += draw.amount_received;
          totalSavings += draw.savings || 0;
          totalDeductions += draw.deductions || 0;
          totalPaidOut += draw.paid_out || 0;
          totalBalance += draw.balance || 0;
        }
      });
    });

    return { totalWon, totalSavings, totalDeductions, totalPaidOut, totalBalance, wins };
  };

  const getGroupTotals = () => {
    let totalPaidOut = 0;
    let totalSavings = 0;
    let totalDeductions = 0;
    let totalWinners = 0;

    cycles.forEach(cycle => {
      cycle.draws.forEach(draw => {
        if (draw.winner_name) {
          totalWinners++;
          totalPaidOut += draw.amount_received;
          totalSavings += draw.savings || 0;
          totalDeductions += draw.deductions || 0;
        }
      });
    });

    return { totalPaidOut, totalSavings, totalDeductions, totalWinners };
  };

  return (
    <RoscaContext.Provider value={{ 
      cycles, 
      setCycles, 
      loading,
      seeded,
      updateDraw, 
      addDraw, 
      refreshCycles,
      getMemberStats, 
      getGroupTotals 
    }}>
      {children}
    </RoscaContext.Provider>
  );
};

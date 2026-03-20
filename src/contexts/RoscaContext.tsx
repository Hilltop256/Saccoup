import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MOCK_PBS_CYCLES, type RoscaCycle, type RoscaDraw } from '@/lib/constants';
import * as ds from '@/lib/dataService';
import { useAppContext } from './AppContext';

export interface RoscaDrawWithId extends RoscaDraw {
  _db_id?: string;
}
export interface RoscaCycleWithId extends Omit<RoscaCycle, 'draws'> {
  _db_id?: string;
  draws: RoscaDrawWithId[];
}

export interface RoscaMemberAccount {
  id: string;
  cycle_id: string;
  member_id: string;
  member_name: string;
  monthly_contributions: Record<string, { amount: number; status: string; paid_at: string | null }>;
  welfare_contributions: Record<string, { amount: number; status: string; paid_at: string | null }>;
  draws_won: number;
  draw_wins: { draw_number: number; slot: string; amount: number; date: string; confirmed: boolean }[];
  security_deposit: number;
  total_contributions: number;
  total_welfare: number;
  total_received: number;
  balance: number;
}

export interface RoscaWelfareExpenditure {
  id: string;
  cycle_id: string;
  draw_number: number;
  draw_date: string;
  description: string;
  amount: number;
}

export interface RoscaWelfareSummary {
  total_collected: number;
  total_expended: number;
  balance: number;
}

interface RoscaContextType {
  cycles: RoscaCycleWithId[];
  memberAccounts: RoscaMemberAccount[];
  welfareExpenditures: RoscaWelfareExpenditure[];
  welfareSummary: RoscaWelfareSummary | null;
  loading: boolean;
  userRole: 'chairman' | 'secretary' | 'treasurer' | 'member';
  canEdit: boolean;
  canManageWelfare: boolean;
  canManageCycles: boolean;
  updateDraw: (cycleNumber: number, updatedDraw: RoscaDraw) => Promise<void>;
  addDraw: (cycleNumber: number, newDraw: RoscaDraw) => Promise<void>;
  createCycle: (params: {
    cycle_name: string;
    status: 'upcoming' | 'active' | 'completed';
    start_date: string;
    end_date?: string;
    total_draws?: number;
    pot_amount_per_draw?: number;
    member_count?: number;
    security_deposit?: number;
    notes?: string;
  }) => Promise<void>;
  recordMonthlyContribution: (memberId: string, drawNumber: number, amount: number, status: 'pending' | 'confirmed') => Promise<void>;
  recordWelfareContribution: (memberId: string, drawNumber: number, amount: number, status: 'pending' | 'confirmed') => Promise<void>;
  recordDrawWin: (memberId: string, drawNumber: number, slot: '1' | '2', amount: number, drawDate: string) => Promise<void>;
  updateSecurityDeposit: (memberId: string, amount: number) => Promise<void>;
  addWelfareExpenditure: (drawNumber: number, drawDate: string, description: string, amount: number) => Promise<void>;
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
  const { selectedGroupId, selectedGroup, user } = useAppContext();
  const [cycles, setCycles] = useState<RoscaCycleWithId[]>([]);
  const [memberAccounts, setMemberAccounts] = useState<RoscaMemberAccount[]>([]);
  const [welfareExpenditures, setWelfareExpenditures] = useState<RoscaWelfareExpenditure[]>([]);
  const [welfareSummary, setWelfareSummary] = useState<RoscaWelfareSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const role = (selectedGroup?.user_role || '').toLowerCase();
  const userRole: 'chairman' | 'secretary' | 'treasurer' | 'member' =
    role === 'chairman' || role === 'chairperson' ? 'chairman' :
    role === 'secretary' ? 'secretary' :
    role === 'treasurer' ? 'treasurer' : 'member';

  const canEdit = ['chairman', 'secretary'].includes(role);
  const canManageWelfare = ['chairman', 'secretary'].includes(role);
  const canManageCycles = role === 'chairman';

  const loadCycles = useCallback(async () => {
    if (!selectedGroupId) {
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
        setCycles([]);
      }
    } catch (e) {
      console.error('Failed to load ROSCA cycles:', e);
      setCycles(MOCK_PBS_CYCLES.map(c => ({ ...c, _db_id: undefined, draws: c.draws.map(d => ({ ...d, _db_id: undefined })) })));
    }
    setLoading(false);
  }, [selectedGroupId]);

  const loadMemberAccounts = useCallback(async (cycleDbId: string) => {
    if (!cycleDbId) { setMemberAccounts([]); return; }
    try {
      const { accounts } = await ds.listRoscaMemberAccounts(cycleDbId);
      setMemberAccounts(accounts || []);
    } catch (e) { setMemberAccounts([]); }
  }, []);

  const loadWelfareData = useCallback(async (cycleDbId: string) => {
    if (!cycleDbId) { setWelfareExpenditures([]); setWelfareSummary(null); return; }
    try {
      const [expRes, summaryRes] = await Promise.all([
        ds.listWelfareExpenditures(cycleDbId),
        ds.getWelfareSummary(cycleDbId),
      ]);
      setWelfareExpenditures(expRes.expenditures || []);
      setWelfareSummary(summaryRes.summary);
    } catch (e) { setWelfareExpenditures([]); setWelfareSummary(null); }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  const seedToSupabase = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const { cycles: existing } = await ds.listRoscaCycles(selectedGroupId);
      if (existing && existing.length > 0) return;
      for (const cycle of MOCK_PBS_CYCLES) {
        const { cycle: newCycle } = await ds.createRoscaCycle({
          group_id: selectedGroupId, cycle_number: cycle.cycle_number, cycle_name: cycle.cycle_name,
          status: cycle.status, start_date: cycle.start_date, end_date: cycle.end_date,
          total_draws: cycle.total_draws, pot_amount_per_draw: cycle.pot_amount_per_draw,
          member_count: cycle.draws.length / 2, security_deposit: cycle.cycle_number === 3 ? 500000 : 0,
        });
        if (newCycle) {
          for (const draw of cycle.draws) {
            await ds.createRoscaDraw({
              cycle_id: newCycle.id, draw_number: draw.draw_number, winner_slot: draw.winner_slot,
              winner_name: draw.winner_name || undefined, amount_received: draw.amount_received,
              draw_date: draw.draw_date, savings: draw.savings, paid_out: draw.paid_out,
              deductions: draw.deductions, balance: draw.balance, status: draw.status, notes: draw.notes,
            });
          }
        }
      }
      await loadCycles();
    } catch (e) { console.error('Failed to seed ROSCA data:', e); }
  }, [selectedGroupId, loadCycles]);

  useEffect(() => {
    if (!loading && cycles.length === 0 && selectedGroupId) seedToSupabase();
  }, [loading, cycles.length, selectedGroupId, seedToSupabase]);

  useEffect(() => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (activeCycle?._db_id) { loadMemberAccounts(activeCycle._db_id); loadWelfareData(activeCycle._db_id); }
  }, [cycles, loadMemberAccounts, loadWelfareData]);

  const refreshCycles = useCallback(async () => { await loadCycles(); }, [loadCycles]);

  const createCycle = useCallback(async (params: Parameters<typeof ds.createRoscaCycle>[0]) => {
    if (!selectedGroupId) throw new Error('No group selected');
    const maxNum = Math.max(0, ...cycles.map(c => c.cycle_number));
    await ds.createRoscaCycle({
      group_id: selectedGroupId, cycle_number: maxNum + 1, cycle_name: params.cycle_name,
      status: params.status, start_date: params.start_date, end_date: params.end_date,
      total_draws: params.total_draws ?? 10, pot_amount_per_draw: params.pot_amount_per_draw ?? 5000000,
      member_count: params.member_count ?? 20, security_deposit: params.security_deposit ?? 0, notes: params.notes,
    });
    await loadCycles();
  }, [cycles, selectedGroupId, loadCycles]);

  const updateDraw = useCallback(async (cycleNumber: number, updatedDraw: RoscaDraw) => {
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== cycleNumber) return c;
      return { ...c, draws: c.draws.map(d =>
        d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot
          ? { ...updatedDraw, _db_id: d._db_id } : d) };
    }));
    if (!selectedGroupId) return;
    try {
      const cycle = cycles.find(c => c.cycle_number === cycleNumber);
      const draw = cycle?.draws.find(d => d.draw_number === updatedDraw.draw_number && d.winner_slot === updatedDraw.winner_slot);
      if (draw?._db_id) {
        await ds.updateRoscaDraw(draw._db_id, {
          winner_name: updatedDraw.winner_name, winner_id: updatedDraw.winner_id,
          amount_received: updatedDraw.amount_received, draw_date: updatedDraw.draw_date,
          savings: updatedDraw.savings ?? null, paid_out: updatedDraw.paid_out ?? null,
          deductions: updatedDraw.deductions ?? null, balance: updatedDraw.balance ?? null,
          status: updatedDraw.status, notes: updatedDraw.notes ?? null,
        });
      } else if (cycle?._db_id) {
        await ds.createRoscaDraw({
          cycle_id: cycle._db_id, draw_number: updatedDraw.draw_number, winner_slot: updatedDraw.winner_slot,
          winner_name: updatedDraw.winner_name || undefined, amount_received: updatedDraw.amount_received,
          draw_date: updatedDraw.draw_date, savings: updatedDraw.savings, paid_out: updatedDraw.paid_out,
          deductions: updatedDraw.deductions, balance: updatedDraw.balance, status: updatedDraw.status, notes: updatedDraw.notes,
        });
        await loadCycles();
      }
    } catch (e) { console.error('Failed to persist draw update:', e); }
  }, [cycles, selectedGroupId, loadCycles]);

  const addDraw = useCallback(async (cycleNumber: number, newDraw: RoscaDraw) => {
    const cycle = cycles.find(c => c.cycle_number === cycleNumber);
    if (!cycle) return;
    const existingNums = new Set(cycle.draws.map(d => d.draw_number));
    const nextNum = existingNums.size + 1;
    const drawEntry: RoscaDrawWithId = { ...newDraw, draw_number: nextNum, _db_id: undefined };
    setCycles(prev => prev.map(c => {
      if (c.cycle_number !== cycleNumber) return c;
      return { ...c, draws: [...c.draws, drawEntry] };
    }));
    if (cycle._db_id) {
      try {
        await ds.createRoscaDraw({
          cycle_id: cycle._db_id, draw_number: nextNum, winner_slot: newDraw.winner_slot,
          winner_name: newDraw.winner_name || undefined, amount_received: newDraw.amount_received,
          draw_date: newDraw.draw_date, savings: newDraw.savings, paid_out: newDraw.paid_out,
          deductions: newDraw.deductions, balance: newDraw.balance, status: newDraw.status, notes: newDraw.notes,
        });
        await loadCycles();
      } catch (e) { console.error('Failed to persist new draw:', e); }
    }
  }, [cycles, loadCycles]);

  const recordMonthlyContribution = useCallback(async (memberId: string, drawNumber: number, amount: number, status: 'pending' | 'confirmed') => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (!activeCycle?._db_id) return;
    await ds.recordMonthlyContribution({ cycle_id: activeCycle._db_id, member_id: memberId, draw_number: drawNumber, amount, status });
    await loadMemberAccounts(activeCycle._db_id);
  }, [cycles, loadMemberAccounts]);

  const recordWelfareContribution = useCallback(async (memberId: string, drawNumber: number, amount: number, status: 'pending' | 'confirmed') => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (!activeCycle?._db_id) return;
    await ds.recordWelfareContribution({ cycle_id: activeCycle._db_id, member_id: memberId, draw_number: drawNumber, amount, status });
    await loadMemberAccounts(activeCycle._db_id);
    await loadWelfareData(activeCycle._db_id);
  }, [cycles, loadMemberAccounts, loadWelfareData]);

  const recordDrawWin = useCallback(async (memberId: string, drawNumber: number, slot: '1' | '2', amount: number, drawDate: string) => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (!activeCycle?._db_id) return;
    await ds.recordDrawWin({ cycle_id: activeCycle._db_id, member_id: memberId, draw_number: drawNumber, slot, amount, draw_date: drawDate });
    await loadMemberAccounts(activeCycle._db_id);
  }, [cycles, loadMemberAccounts]);

  const updateSecurityDeposit = useCallback(async (memberId: string, amount: number) => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (!activeCycle?._db_id) return;
    await ds.updateSecurityDeposit({ cycle_id: activeCycle._db_id, member_id: memberId, security_deposit: amount });
    await loadMemberAccounts(activeCycle._db_id);
  }, [cycles, loadMemberAccounts]);

  const addWelfareExpenditure = useCallback(async (drawNumber: number, drawDate: string, description: string, amount: number) => {
    const activeCycle = cycles.find(c => c.status === 'active') || cycles[cycles.length - 1];
    if (!activeCycle?._db_id) return;
    await ds.addWelfareExpenditure({ cycle_id: activeCycle._db_id, draw_number: drawNumber, draw_date: drawDate, description, amount, recorded_by: user?.member_id });
    await loadWelfareData(activeCycle._db_id);
  }, [cycles, user, loadWelfareData]);

  const getMemberStats = useCallback((memberName: string) => {
    let totalWon = 0, totalSavings = 0, totalDeductions = 0, totalPaidOut = 0, totalBalance = 0, wins = 0;
    cycles.forEach(cycle => { cycle.draws.forEach(draw => {
      if (draw.winner_name === memberName) { wins++; totalWon += draw.amount_received; totalSavings += draw.savings || 0; totalDeductions += draw.deductions || 0; totalPaidOut += draw.paid_out || 0; totalBalance += draw.balance || 0; }
    }); });
    return { totalWon, totalSavings, totalDeductions, totalPaidOut, totalBalance, wins };
  }, [cycles]);

  const getGroupTotals = useCallback(() => {
    let totalPaidOut = 0, totalSavings = 0, totalDeductions = 0, totalWinners = 0;
    cycles.forEach(cycle => { cycle.draws.forEach(draw => {
      if (draw.winner_name) { totalWinners++; totalPaidOut += draw.amount_received; totalSavings += draw.savings || 0; totalDeductions += draw.deductions || 0; }
    }); });
    return { totalPaidOut, totalSavings, totalDeductions, totalWinners };
  }, [cycles]);

  return (
    <RoscaContext.Provider value={{
      cycles, memberAccounts, welfareExpenditures, welfareSummary, loading,
      userRole, canEdit, canManageWelfare, canManageCycles,
      updateDraw, addDraw, createCycle, recordMonthlyContribution, recordWelfareContribution,
      recordDrawWin, updateSecurityDeposit, addWelfareExpenditure, refreshCycles, getMemberStats, getGroupTotals,
    }}>
      {children}
    </RoscaContext.Provider>
  );
};

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MOCK_PBS_CYCLES, type RoscaCycle, type RoscaDraw } from '@/lib/constants';

interface RoscaContextType {
  cycles: RoscaCycle[];
  setCycles: React.Dispatch<React.SetStateAction<RoscaCycle[]>>;
  updateDraw: (cycleNumber: number, updatedDraw: RoscaDraw) => void;
  addDraw: (cycleNumber: number, newDraw: RoscaDraw) => void;
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

export const RoscaProvider: React.FC<RoscaProviderProps> = ({ children }) => {
  const [cycles, setCycles] = useState<RoscaCycle[]>(MOCK_PBS_CYCLES);

  const updateDraw = (cycleNumber: number, updatedDraw: RoscaDraw) => {
    setCycles(prev => prev.map(cycle => {
      if (cycle.cycle_number !== cycleNumber) return cycle;
      return {
        ...cycle,
        draws: cycle.draws.map(draw =>
          draw.draw_number === updatedDraw.draw_number && draw.winner_slot === updatedDraw.winner_slot
            ? updatedDraw
            : draw
        ),
      };
    }));
  };

  const addDraw = (cycleNumber: number, newDraw: RoscaDraw) => {
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
    <RoscaContext.Provider value={{ cycles, setCycles, updateDraw, addDraw, getMemberStats, getGroupTotals }}>
      {children}
    </RoscaContext.Provider>
  );
};

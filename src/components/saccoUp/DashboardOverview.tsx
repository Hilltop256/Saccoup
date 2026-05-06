import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import * as ds from '@/lib/dataService';
import { formatUGX, getStatusColor, IMAGES } from '@/lib/constants';
import type { DashboardPage } from './Sidebar';

// ... (Keep existing interfaces: GroupStats, ContributionRow, etc.)

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { user, selectedGroup } = useAppContext();
  const { getGroupTotals, cycles } = useRoscaData(); // Removed contributionStatuses as we will derive from cycles

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const roscaTotals = getGroupTotals();
  
  // 1. Identify the Active Cycle
  const activeCycle = useMemo(() => cycles?.find(c => c.status === 'active') || cycles?.[0], [cycles]);
  
  // 2. Identify the Current Draw Number
  const currentDrawNum = useMemo(() => {
    if (!activeCycle?.draws) return 1;
    const completedDraws = activeCycle.draws.filter(d => d.status === 'completed' || d.winner_name).length;
    return completedDraws + 1;
  }, [activeCycle]);

  /**
   * 3. NEW LOGIC: Map member contribution statuses based on Draw Data
   * This maps each member to a status string based on the Savings/Balance logic
   */
  const memberStatusMap = useMemo(() => {
    if (!activeCycle || !activeCycle.draws) return {};
    
    const statusMap: Record<string, string> = {};

    activeCycle.draws.forEach(draw => {
      // Find the status based on your specific requirements
      let status = 'Pending';

      // Status: Confirmed (Savings has 500,000)
      if (draw.savings === 500000) {
        status = 'Confirmed';
      } 
      // Status: Pending (Savings empty and Balance is -500,000)
      else if ((!draw.savings || draw.savings === 0) && draw.balance === -500000) {
        status = 'Pending';
      }
      // Status: Defaulted (Cycle closed and member has no savings)
      if (activeCycle.status === 'completed' && (!draw.savings || draw.savings === 0)) {
        status = 'Defaulted';
      }

      // Map by winner_name (or member_id if available in your draw object)
      if (draw.winner_name) {
        statusMap[draw.winner_name] = status;
      }
    });

    return statusMap;
  }, [activeCycle]);

  /**
   * 4. NEW LOGIC: Tally Status Totals
   */
  const roscaStats = useMemo(() => {
    const vals = Object.values(memberStatusMap);
    return {
      confirmed: vals.filter(v => v === 'Confirmed').length,
      pending: vals.filter(v => v === 'Pending').length,
      defaulted: vals.filter(v => v === 'Defaulted').length
    };
  }, [memberStatusMap]);

  // ... (Keep existing loadDashboardData and useEffect)

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Stat Cards (Keep existing code) */}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ROSCA Tracker Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Cycle {activeCycle?.cycle_number || 1} • Draw {currentDrawNum} Status
              </h2>
              <p className="text-xs text-gray-500 mt-1">Status derived from Draw Savings & Balance</p>
            </div>
            <button onClick={() => onNavigate('rosca')} className="text-xs text-[#0066CC] font-bold hover:underline">Manage Draw</button>
          </div>
          
          {members.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {members.map(m => {
                  // Retrieve status using the member's name as the key (since draw records use winner_name)
                  const status = memberStatusMap[m.full_name] || 'Pending';
                  
                  return (
                    <div 
                      key={m.id} 
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                        status === 'Confirmed' ? 'bg-emerald-50 border-emerald-100' : 
                        status === 'Defaulted' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="relative">
                        <img 
                          src={m.photo_url || IMAGES.avatars[0]} 
                          className={`w-10 h-10 rounded-full border-2 ${status === 'Confirmed' ? 'border-emerald-500' : 'border-white'}`}
                          alt="" 
                        />
                        {status === 'Confirmed' && (
                          <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-gray-800 mt-2 truncate w-full text-center">
                        {m.full_name.split(' ')[0]}
                      </span>
                      
                      {/* Displaying Status below the name as requested */}
                      <span className={`text-[9px] uppercase font-black mt-1 ${
                        status === 'Confirmed' ? 'text-emerald-600' : status === 'Defaulted' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Tallying the totals */}
              <div className="flex items-center justify-around py-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-center">
                  <p className="text-xl font-black text-emerald-600">{roscaStats.confirmed}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Confirmed</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <p className="text-xl font-black text-amber-500">{roscaStats.pending}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pending</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <p className="text-xl font-black text-red-500">{roscaStats.defaulted}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Defaulted</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">No cycle data found.</div>
          )}
        </div>

        {/* Loan Applications Section (Keep existing code) */}
      </div>

      {/* Recent Transactions Table (Keep existing code) */}
    </div>
  );
};

export default DashboardOverview;

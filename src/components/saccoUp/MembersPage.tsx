import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useRoscaData } from '@/contexts/RoscaContext';
import { formatUGX, getRoleColor, IMAGES, type UserRole } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface MemberRow {
  id: string; full_name: string; phone: string; email?: string;
  national_id?: string; kyc_verified: boolean; photo_url?: string;
  role: UserRole; totalContributions: number; loanBalance: number; savingsBalance: number;
}

// All roles available for admin to assign
const ALL_ROLES: { value: UserRole; label: string; emoji: string }[] = [
  { value: 'member',      label: 'Member',      emoji: '👤' },
  { value: 'secretary',   label: 'Secretary',   emoji: '📋' },
  { value: 'treasurer',   label: 'Treasurer',   emoji: '💰' },
  { value: 'chairperson', label: 'Chairperson', emoji: '🪑' },
  { value: 'admin',       label: 'Admin',       emoji: '⚙️' },
];

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const MembersPage: React.FC = () => {
  const { user, selectedGroup } = useAppContext();
  const { getMemberStats } = useRoscaData();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ full_name: '', phone: '', email: '', national_id: '', role: 'member' as UserRole });

  const role = (selectedGroup?.user_role || '').toLowerCase();
  const isAdmin = ['admin', 'super_admin', 'chairperson', 'chairman', 'secretary'].includes(role);

  const loadMembers = useCallback(async () => {
    if (!selectedGroup?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await ds.listMembers(selectedGroup.id);
      if (result.success && result.members) {
        setMembers(result.members.map((m: any) => ({
          id: m.id, full_name: m.full_name, phone: m.phone, email: m.email,
          national_id: m.national_id, kyc_verified: m.kyc_verified || false,
          photo_url: m.photo_url, role: m.role || 'member',
          totalContributions: m.totalContributions || 0,
          loanBalance: m.loanBalance || 0,
          savingsBalance: m.savingsBalance || m.totalContributions || 0,
        })));
      }
    } catch (e: any) { console.error('Failed to load members:', e); }
    setLoading(false);
  }, [selectedGroup?.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // When opening detail modal, pre-set the pending role to current role
  const openMemberDetail = (m: MemberRow) => {
    setSelectedMember(m);
    setPendingRole(m.role);
    setError(null);
  };

  const filtered = members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAddMember = async () => {
    if (!newMember.full_name || !newMember.phone || !selectedGroup?.id) return;
    setIsAdding(true);
    setError(null);
    try {
      const result = await ds.addMemberToGroup({
        group_id: selectedGroup.id,
        full_name: newMember.full_name,
        phone: newMember.phone,
        email: newMember.email || undefined,
        national_id: newMember.national_id || undefined,
        role: newMember.role,
        added_by: user?.member_id,
      });
      if (result.success) {
        setSuccess(`${newMember.full_name} added to the group successfully!`);
        setNewMember({ full_name: '', phone: '', email: '', national_id: '', role: 'member' });
        setShowAddModal(false);
        await loadMembers();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to add member');
    }
    setIsAdding(false);
  };

  const handleChangeRole = async () => {
    if (!selectedMember || !pendingRole || !selectedGroup?.id) return;
    if (pendingRole === selectedMember.role) return; // no change
    setIsChangingRole(true);
    setError(null);
    try {
      await ds.updateMemberRole(selectedGroup.id, selectedMember.id, pendingRole);
      // Update local state immediately
      setMembers(prev => prev.map(m =>
        m.id === selectedMember.id ? { ...m, role: pendingRole } : m
      ));
      setSelectedMember(prev => prev ? { ...prev, role: pendingRole } : null);
      setSuccess(`${selectedMember.full_name}'s role changed to ${pendingRole}!`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to update role. Please try again.');
    }
    setIsChangingRole(false);
  };

  const handleRemoveMember = async (id: string) => {
    if (!selectedGroup?.id) return;
    try {
      await ds.removeMember(selectedGroup.id, id, user?.member_id);
      setSelectedMember(null);
      setSuccess('Member removed from group.');
      await loadMembers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
  };

  const getAvatar = (m: MemberRow) => m.photo_url || IMAGES.avatars[Math.abs(m.full_name.charCodeAt(0)) % IMAGES.avatars.length];

  if (!selectedGroup) {
    return (
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" /></svg>
        </div>
        <h3 className="text-lg font-extrabold text-gray-900 mb-2">No Group Selected</h3>
        <p className="text-sm text-gray-500">Please select or create a group first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">👥 Members</h1>
          <p className="text-sm text-purple-500 font-semibold">{members.length} members in {selectedGroup.name}</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md shadow-purple-300/40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Member
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-bold">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none bg-white font-semibold"
        >
          <option value="all">All Roles</option>
          {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>)}
        </select>
      </div>

      {/* Members table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-12 text-center">
          <svg className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <p className="text-sm text-gray-500 font-semibold">Loading members...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
                  <th className="text-left px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="text-right px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Savings</th>
                  <th className="text-right px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Loans</th>
                  <th className="text-right px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider hidden xl:table-cell">ROSCA</th>
                  <th className="text-center px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider">KYC</th>
                  <th className="text-right px-6 py-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400 font-semibold">No members found. Add your first member to get started! 👋</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-purple-50/30 transition-colors cursor-pointer" onClick={() => openMemberDetail(m)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={getAvatar(m)} alt={m.full_name} className="w-9 h-9 rounded-full object-cover border-2 border-purple-100" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{m.full_name}</p>
                          <p className="text-xs text-gray-500 sm:hidden">{m.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell font-semibold">{m.phone}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${getRoleColor(m.role)}`}>{m.role}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right hidden lg:table-cell">{formatUGX(m.savingsBalance)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right hidden lg:table-cell">
                      <span className={m.loanBalance > 0 ? 'text-amber-600' : 'text-gray-400'}>{formatUGX(m.loanBalance)}</span>
                    </td>
                    <td className="px-6 py-4 text-right hidden xl:table-cell">
                      {(() => { const rs = getMemberStats(m.full_name); return rs.wins > 0 ? (
                        <span className="text-sm font-bold text-emerald-600">{formatUGX(rs.totalWon)}</span>
                      ) : <span className="text-sm text-gray-400">—</span>; })()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {m.kyc_verified ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); openMemberDetail(m); }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Member Modal ─────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowAddModal(false); setError(null); }}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-purple-200/40" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold">➕ Add New Member</h2>
                  <p className="text-sm text-purple-100 font-semibold">Add a member to {selectedGroup.name}</p>
                </div>
                <button onClick={() => { setShowAddModal(false); setError(null); }} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-semibold">⚠️ {error}</div>}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Full Name *</label>
                <input type="text" value={newMember.full_name} onChange={(e) => setNewMember({...newMember, full_name: e.target.value})} className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" placeholder="Enter full name" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Phone Number *</label>
                <input type="tel" value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" placeholder="+256 7XX XXX XXX" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="email" value={newMember.email} onChange={(e) => setNewMember({...newMember, email: e.target.value})} className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">National ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={newMember.national_id} onChange={(e) => setNewMember({...newMember, national_id: e.target.value})} className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" placeholder="CM12345678" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Role</label>
                <select value={newMember.role} onChange={(e) => setNewMember({...newMember, role: e.target.value as UserRole})} className="w-full px-3 py-2.5 text-sm border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none bg-white font-semibold">
                  {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowAddModal(false); setError(null); }} className="flex-1 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                onClick={handleAddMember}
                disabled={isAdding || !newMember.full_name || !newMember.phone}
                className="flex-1 py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-purple-300/40"
              >
                {isAdding ? <><Spinner />Adding...</> : '➕ Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Member Detail Modal ──────────────────────────────────────────── */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl shadow-purple-200/40" onClick={(e) => e.stopPropagation()}>
            {/* Member header */}
            <div className="bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#ec4899] px-6 py-6 text-white relative">
              <button onClick={() => setSelectedMember(null)} className="absolute right-4 top-4 p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-4">
                <img
                  src={getAvatar(selectedMember)}
                  alt={selectedMember.full_name}
                  className="w-16 h-16 rounded-full object-cover border-3 border-white/50 shadow-lg"
                />
                <div>
                  <h3 className="text-xl font-extrabold">{selectedMember.full_name}</h3>
                  <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-white/20 text-white`}>
                    {ALL_ROLES.find(r => r.value === selectedMember.role)?.emoji} {selectedMember.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">📞 Phone</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedMember.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">🪪 National ID</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedMember.national_id || 'Not provided'}</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">💰 Total Savings</p>
                  <p className="text-sm font-extrabold text-purple-700 mt-0.5">{formatUGX(selectedMember.savingsBalance)}</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">🏦 Loan Balance</p>
                  <p className={`text-sm font-extrabold mt-0.5 ${selectedMember.loanBalance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {formatUGX(selectedMember.loanBalance)}
                  </p>
                </div>
                {(() => { const rs = getMemberStats(selectedMember.full_name); return rs.wins > 0 ? (
                  <>
                    <div className="bg-emerald-50 rounded-2xl p-3">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">🎡 ROSCA Won</p>
                      <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{formatUGX(rs.totalWon)}</p>
                    </div>
                    <div className="bg-cyan-50 rounded-2xl p-3">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">📋 ROSCA Wins</p>
                      <p className="text-sm font-extrabold text-cyan-700 mt-0.5">{rs.wins} draw{rs.wins > 1 ? 's' : ''}</p>
                    </div>
                  </>
                ) : null; })()}
              </div>

              {/* KYC status */}
              <div className={`flex items-center gap-3 rounded-2xl p-3 ${selectedMember.kyc_verified ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedMember.kyc_verified ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                  {selectedMember.kyc_verified
                    ? <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">KYC Verification</p>
                  <p className={`text-xs font-semibold ${selectedMember.kyc_verified ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {selectedMember.kyc_verified ? '✅ Verified' : '⏳ Not yet verified'}
                  </p>
                </div>
              </div>

              {/* ── Role Change Section (admin only) ── */}
              {isAdmin && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                  <p className="text-sm font-extrabold text-purple-700 mb-3">🛡️ Change Member Role</p>

                  {/* Role buttons */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {ALL_ROLES.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setPendingRole(r.value)}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all ${
                          pendingRole === r.value
                            ? 'border-purple-500 bg-purple-600 text-white shadow-md'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        <span className="text-base mb-0.5">{r.emoji}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {error && <p className="text-xs text-red-600 font-semibold mb-2">⚠️ {error}</p>}

                  <button
                    onClick={handleChangeRole}
                    disabled={isChangingRole || pendingRole === selectedMember.role}
                    className="w-full py-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-[#7c3aed] to-[#ec4899] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-purple-300/40"
                  >
                    {isChangingRole ? (
                      <><Spinner />Updating role...</>
                    ) : pendingRole === selectedMember.role ? (
                      'Select a different role to change'
                    ) : (
                      `✅ Change to ${ALL_ROLES.find(r => r.value === pendingRole)?.label}`
                    )}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                {isAdmin && selectedMember.id !== user?.member_id && (
                  <button
                    onClick={() => handleRemoveMember(selectedMember.id)}
                    className="px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;

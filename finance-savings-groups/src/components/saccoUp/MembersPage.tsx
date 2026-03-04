import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getRoleColor, IMAGES, type UserRole } from '@/lib/constants';
import * as ds from '@/lib/dataService';

interface MemberRow {
  id: string; full_name: string; phone: string; email?: string;
  national_id?: string; kyc_verified: boolean; photo_url?: string;
  role: UserRole; totalContributions: number; loanBalance: number; savingsBalance: number;
}

const MembersPage: React.FC = () => {
  const { user, selectedGroup } = useAppContext();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ full_name: '', phone: '', email: '', national_id: '', role: 'member' as UserRole });

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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Group Selected</h3>
        <p className="text-sm text-gray-500">Please select or create a group first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500">{members.length} members in {selectedGroup.name}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Member
          </button>
        </div>
      </div>

      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="treasurer">Treasurer</option>
          <option value="chairperson">Chairperson</option>
          <option value="member">Member</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <svg className="w-8 h-8 animate-spin text-[#0066CC] mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <p className="text-sm text-gray-500">Loading members...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Savings</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Loans</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">KYC</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">No members found. Add your first member to get started.</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedMember(m)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={getAvatar(m)} alt={m.full_name} className="w-9 h-9 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.full_name}</p>
                          <p className="text-xs text-gray-500 sm:hidden">{m.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{m.phone}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleColor(m.role)}`}>{m.role}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right hidden lg:table-cell">{formatUGX(m.savingsBalance)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-right hidden lg:table-cell">
                      <span className={m.loanBalance > 0 ? 'text-amber-600' : 'text-gray-400'}>{formatUGX(m.loanBalance)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {m.kyc_verified ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#00CC99]/10">
                          <svg className="w-3.5 h-3.5 text-[#00CC99]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedMember(m); }} className="p-1.5 text-gray-400 hover:text-[#0066CC] transition-colors">
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

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Add New Member</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                <input type="text" value={newMember.full_name} onChange={(e) => setNewMember({...newMember, full_name: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="Enter full name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number *</label>
                <input type="tel" value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="+256 7XX XXX XXX" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                <input type="email" value={newMember.email} onChange={(e) => setNewMember({...newMember, email: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">National ID</label>
                <input type="text" value={newMember.national_id} onChange={(e) => setNewMember({...newMember, national_id: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="CM12345678" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
                <select value={newMember.role} onChange={(e) => setNewMember({...newMember, role: e.target.value as UserRole})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
                  <option value="member">Member</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="chairperson">Chairperson</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleAddMember} disabled={isAdding || !newMember.full_name || !newMember.phone} className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isAdding ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Adding...</>
                ) : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Member Details</h2>
              <button onClick={() => setSelectedMember(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <img src={getAvatar(selectedMember)} alt="" className="w-16 h-16 rounded-full object-cover" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedMember.full_name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleColor(selectedMember.role)}`}>{selectedMember.role}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium text-gray-900">{selectedMember.phone}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">National ID</p>
                <p className="text-sm font-medium text-gray-900">{selectedMember.national_id || 'Not provided'}</p>
              </div>
              <div className="bg-[#0066CC]/5 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Savings</p>
                <p className="text-sm font-bold text-[#0066CC]">{formatUGX(selectedMember.savingsBalance)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Loan Balance</p>
                <p className="text-sm font-bold text-amber-600">{formatUGX(selectedMember.loanBalance)}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedMember(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Close</button>
              <button onClick={() => handleRemoveMember(selectedMember.id)} className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;

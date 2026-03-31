import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { formatUGX, getGroupTypeLabel, getGroupTypeColor, type GroupType } from '@/lib/constants';
import * as ds from '@/lib/dataService';

type ModalMode = 'create' | 'join' | null;

const GroupsPage: React.FC = () => {
  const { user, groups, refreshGroups, setSelectedGroupId, isChairman } = useAppContext();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newGroup, setNewGroup] = useState({
    name: '',
    group_type: 'savings_club' as GroupType,
    contribution_amount: '',
    contribution_schedule: 'monthly',
    description: '',
    interest_rate: '5',
    late_fee: '0',
    grace_period_days: '3',
  });
  const [joinCode, setJoinCode] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleRegenerate = async (groupId: string) => {
    setRegeneratingId(groupId);
    try {
      const result = await ds.regenerateInviteCode(groupId);
      if (result.success) {
        await refreshGroups();
        setSuccess('Invite code regenerated!');
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setRegeneratingId(null);
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard?.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const handleCreate = async () => {
    if (!newGroup.name.trim() || !user?.member_id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await ds.createGroup({
        name: newGroup.name.trim(),
        group_type: newGroup.group_type,
        contribution_amount: parseInt(newGroup.contribution_amount) || 0,
        contribution_schedule: newGroup.contribution_schedule,
        description: newGroup.description.trim(),
        member_id: user.member_id,
        interest_rate: parseFloat(newGroup.interest_rate) || 5,
        late_fee: parseInt(newGroup.late_fee) || 0,
        grace_period_days: parseInt(newGroup.grace_period_days) || 3,
      });
      if (result.success) {
        setSuccess(`Group "${result.group.name}" created! Invite code: ${result.group.invite_code}`);
        setNewGroup({
          name: '', group_type: 'savings_club', contribution_amount: '',
          contribution_schedule: 'monthly', description: '',
          interest_rate: '5', late_fee: '0', grace_period_days: '3',
        });
        setModalMode(null);
        await refreshGroups();
        if (result.group?.id) setSelectedGroupId(result.group.id);
        setTimeout(() => setSuccess(null), 8000);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create group. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user?.member_id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await ds.joinGroupByInviteCode(joinCode.trim(), user.member_id);
      if (result.success) {
        setSuccess(`Successfully joined "${result.group!.name}"!`);
        setJoinCode('');
        setModalMode(null);
        await refreshGroups();
        if (result.group?.id) setSelectedGroupId(result.group.id);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Could not join group. Please check the invite code.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to join group. Please try again.');
    }
    setIsSubmitting(false);
  };

  const closeModal = () => {
    setModalMode(null);
    setError(null);
    setJoinCode('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          <p className="text-sm text-gray-500">Manage your savings groups and cooperatives</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalMode('join')}
            className="px-4 py-2 text-sm font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            Join Group
          </button>
          <button
            onClick={() => setModalMode('create')}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Group
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}

      {error && !modalMode && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#0066CC]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#0066CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Groups Yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first savings group or join one with an invite code.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setModalMode('create')}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors"
            >
              Create Your First Group
            </button>
            <button
              onClick={() => setModalMode('join')}
              className="px-6 py-2.5 text-sm font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors"
            >
              Join with Invite Code
            </button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
            >
              <div className="h-2 bg-gradient-to-r from-[#0066CC] to-[#00CC99]" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-[#0066CC] transition-colors">{g.name}</h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getGroupTypeColor(g.group_type as GroupType)}`}>
                      {getGroupTypeLabel(g.group_type as GroupType)}
                    </span>
                    {g.user_role && (
                      <span className="inline-block ml-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 capitalize">
                        {g.user_role}
                      </span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#0066CC]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#0066CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="text-lg font-bold text-gray-900">{g.members_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Savings</p>
                    <p className="text-lg font-bold text-[#00CC99]">{formatUGX(g.total_savings)}</p>
                  </div>
                </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Contribution</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatUGX(g.contribution_amount)} / {g.contribution_schedule}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(g.invite_code); }}
                        className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Click to copy code"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                        <span className="font-mono font-medium">{g.invite_code}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyLink(g.invite_code); }}
                        className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Copy invite link"
                      >
                        {copiedCode === g.invite_code ? 'Copied!' : 'Copy Link'}
                      </button>
                      {isChairman && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRegenerate(g.id); }}
                          disabled={regeneratingId === g.id}
                          className="px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          title="Generate new invite code"
                        >
                          {regeneratingId === g.id ? '...' : 'New Code'}
                        </button>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Create New Group</h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name *</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                  placeholder="e.g. Kampala Women Savings Club"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Group Type</label>
                <select
                  value={newGroup.group_type}
                  onChange={(e) => setNewGroup({ ...newGroup, group_type: e.target.value as GroupType })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                >
                  <option value="savings_club">Savings Club</option>
                  <option value="investment_club">Investment Club</option>
                  <option value="sacco">SACCO</option>
                  <option value="rosca">ROSCA (Merry-Go-Round)</option>
                  <option value="hybrid">Hybrid Cooperative</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution (UGX)</label>
                  <input
                    type="number"
                    value={newGroup.contribution_amount}
                    onChange={(e) => setNewGroup({ ...newGroup, contribution_amount: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                    placeholder="50000"
                    min="1000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Schedule</label>
                  <select
                    value={newGroup.contribution_schedule}
                    onChange={(e) => setNewGroup({ ...newGroup, contribution_schedule: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Interest Rate (%)</label>
                  <input
                    type="number"
                    value={newGroup.interest_rate}
                    onChange={(e) => setNewGroup({ ...newGroup, interest_rate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                    placeholder="5"
                    min="0"
                    max="100"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Late Fee (UGX)</label>
                  <input
                    type="number"
                    value={newGroup.late_fee}
                    onChange={(e) => setNewGroup({ ...newGroup, late_fee: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Grace (days)</label>
                  <input
                    type="number"
                    value={newGroup.grace_period_days}
                    onChange={(e) => setNewGroup({ ...newGroup, grace_period_days: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                    placeholder="3"
                    min="0"
                    max="30"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none resize-none"
                  rows={3}
                  placeholder="Describe the group's purpose and goals..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting || !newGroup.name.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {modalMode === 'join' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Join a Group</h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-[#0066CC]/5 rounded-xl p-4 mb-6 text-center">
              <svg className="w-10 h-10 text-[#0066CC] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              <p className="text-sm text-gray-600">Ask your group admin for the invite code and enter it below.</p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Invite Code *</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.3em] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none uppercase"
                placeholder="KWS2026A"
                maxLength={12}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Invite codes are case-insensitive</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={isSubmitting || joinCode.length < 4}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Joining...
                  </>
                ) : 'Join Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;

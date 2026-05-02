import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';

const SettingsPage: React.FC = () => {
  const { user, selectedGroup, refreshGroups } = useAppContext();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // General settings
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('savings_club');
  const [description, setDescription] = useState('');
  const [contributionSchedule, setContributionSchedule] = useState('monthly');
  const [umraCompliance, setUmraCompliance] = useState(false);
  const [language, setLanguage] = useState('en');

  // Financial settings
  const [contributionAmount, setContributionAmount] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [lateFee, setLateFee] = useState('0');
  const [gracePeriod, setGracePeriod] = useState('3');

  // Profile settings
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Notification toggles (local-only until backend webhook/SMS is integrated)
  const [smsReminders, setSmsReminders] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [loanAlerts, setLoanAlerts] = useState(true);

  // DB migration check
  const [repaidAmountMissing, setRepaidAmountMissing] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);

  // Load real group settings
  useEffect(() => {
    if (selectedGroup) {
      setGroupName(selectedGroup.name || '');
      setGroupType(selectedGroup.group_type || 'savings_club');
      setDescription(selectedGroup.description || '');
      setContributionSchedule(selectedGroup.contribution_schedule || 'monthly');
      setContributionAmount(String(selectedGroup.contribution_amount || ''));
      setInterestRate(String(selectedGroup.interest_rate || 5));
      setLateFee(String(selectedGroup.late_fee || 0));
      setGracePeriod(String(selectedGroup.grace_period_days || 3));
    }
    if (user) {
  setFullName(user.full_name || '');
  setEmail(user.email || '');
  setNationalId(user.national_id || '');
  setPhone(user.phone || '');
}
    setLoading(false);
  }, [selectedGroup, user]);

  // Check for missing DB migrations
  useEffect(() => {
    supabase.from('loans').select('repaid_amount').limit(1).then(({ error }) => {
      if (error?.message?.includes('repaid_amount')) setRepaidAmountMissing(true);
    });
  }, []);

  const showFeedback = (status: 'success' | 'error', msg: string) => {
    setSaveStatus(status);
    setSaveMsg(msg);
    setTimeout(() => { setSaveStatus('idle'); setSaveMsg(''); }, 4000);
  };

  const handleSaveGeneral = async () => {
    if (!selectedGroup?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('groups')
      .update({
        name: groupName.trim(),
        group_type: groupType,
        description: description.trim(),
        contribution_schedule: contributionSchedule,
      })
      .eq('id', selectedGroup.id);
    if (error) {
      showFeedback('error', 'Failed to save: ' + error.message);
    } else {
      await refreshGroups();
      showFeedback('success', 'Group settings saved successfully!');
    }
    setSaving(false);
  };

  const handleSaveFinancial = async () => {
    if (!selectedGroup?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('groups')
      .update({
        contribution_amount: parseInt(contributionAmount) || 0,
        interest_rate: parseFloat(interestRate) || 5,
        late_fee: parseInt(lateFee) || 0,
        grace_period_days: parseInt(gracePeriod) || 3,
      })
      .eq('id', selectedGroup.id);
    if (error) {
      showFeedback('error', 'Failed to save: ' + error.message);
    } else {
      await refreshGroups();
      showFeedback('success', 'Financial settings saved!');
    }
    setSaving(false);
  };

  const handleSaveProfile = async () => {
  if (!user?.member_id) return;

  setSaving(true);

  try {
    let photoUrl = user.photo_url;

    // ✅ Upload photo if selected
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.member_id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(`profiles/${fileName}`, photoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(`profiles/${fileName}`);

      photoUrl = data.publicUrl;
    }

    // ✅ Normalize phone (reuse your AppContext logic)
    const normalizedPhone = phone.replace(/\s/g, '');

    // 1. Update members table
    const { error: memberError } = await supabase
      .from('members')
      .update({
        full_name: fullName.trim(),
        email: email.trim() || null,
        national_id: nationalId.trim() || null,
        phone: normalizedPhone,
        photo_url: photoUrl
      })
      .eq('id', user.member_id);

    if (memberError) throw memberError;

    // 2. Update user_accounts table (CRITICAL)
    const { error: accountError } = await supabase
      .from('user_accounts')
      .update({ phone: normalizedPhone })
      .eq('id', user.id);

    if (accountError) throw accountError;

    showFeedback('success', 'Profile updated successfully!');

    // 🔁 Force refresh after a short delay (so user sees message)
setTimeout(() => {
  window.location.reload();
}, 1500);

  } catch (error: any) {
    showFeedback('error', 'Failed to save: ' + error.message);
  }

  setSaving(false);
};

  const isAdmin = selectedGroup?.user_role === 'admin' || selectedGroup?.user_role === 'chairperson';

  const tabs = [
    { id: 'general', label: 'General', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'financial', label: 'Financial', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'profile', label: 'My Profile', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
    { id: 'notifications', label: 'Notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <svg className="w-8 h-8 animate-spin text-[#0066CC] mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">
            {selectedGroup ? `Configure ${selectedGroup.name}` : 'Configure your account preferences'}
          </p>
        </div>
        {!isAdmin && selectedGroup && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-xs text-amber-700 font-medium">Only admins can change group settings</span>
          </div>
        )}
      </div>

      {/* Save feedback */}
      {saveStatus === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {saveMsg}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{saveMsg}</div>
      )}

      {/* DB Migration Alert */}
      {repaidAmountMissing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <div>
              <h3 className="font-bold text-amber-800">Database Migration Needed</h3>
              <p className="text-sm text-amber-700 mt-1">Loan repayment tracking requires a one-time schema update. Copy this SQL and run it in your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Supabase SQL Editor</a>:</p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 relative">
            <pre className="text-sm text-green-400 font-mono">ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;</pre>
            <button
              onClick={() => { navigator.clipboard.writeText('ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;'); setMigrationCopied(true); setTimeout(() => setMigrationCopied(false), 3000); }}
              className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              {migrationCopied ? 'Copied!' : 'Copy SQL'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.id ? 'bg-[#0066CC] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Group Settings</h2>
          {!selectedGroup ? (
            <p className="text-sm text-gray-500">No group selected. Create or join a group first.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Group Type</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="savings_club">Savings Club</option>
                    <option value="investment_club">Investment Club</option>
                    <option value="sacco">SACCO</option>
                    <option value="rosca">ROSCA</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Schedule</label>
                  <select
                    value={contributionSchedule}
                    onChange={(e) => setContributionSchedule(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white"
                  >
                    <option value="en">English</option>
                    <option value="lg">Luganda</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Group description..."
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="umra"
                  checked={umraCompliance}
                  onChange={(e) => setUmraCompliance(e.target.checked)}
                  disabled={!isAdmin}
                  className="w-4 h-4 rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]"
                />
                <label htmlFor="umra" className="cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">UMRA Compliance Reporting</span>
                  <p className="text-xs text-gray-500">Enable Uganda Microfinance Regulatory Authority reporting</p>
                </label>
              </div>
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Financial Settings */}
      {activeTab === 'financial' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Financial Rules</h2>
          {!selectedGroup ? (
            <p className="text-sm text-gray-500">No group selected.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Amount (UGX)</label>
                  <input
                    type="number"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Loan Interest Rate (%)</label>
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    min="0"
                    max="100"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Late Payment Fine (UGX)</label>
                  <input
                    type="number"
                    value={lateFee}
                    onChange={(e) => setLateFee(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Grace Period (days)</label>
                  <input
                    type="number"
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    min="0"
                    max="30"
                  />
                </div>
              </div>
              {/* Invite code display */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Group Invite Code</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono font-bold tracking-widest text-[#0066CC]">{selectedGroup.invite_code}</span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(selectedGroup.invite_code)}
                    className="px-3 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded hover:bg-[#0066CC]/20 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Share this code for members to join the group</p>
              </div>
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveFinancial}
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {saving ? 'Saving...' : 'Save Financial Rules'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* My Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">My Profile</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
              <input
  type="text"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
/>
              <p className="text-xs text-gray-400 mt-1">Your Phone Number is Your Login</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">National ID</label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none font-mono uppercase"
                placeholder="CM12345678"
              />
            </div>
      <div className="sm:col-span-2">
  <label className="text-sm font-medium text-gray-700 mb-2 block">Profile Picture</label>

  <div className="flex gap-3">
    {/* Upload from gallery */}
    <label
      htmlFor="fileUpload"
      className="cursor-pointer px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
    >
      Upload Image
    </label>

    {/* Take photo */}
    <label
      htmlFor="cameraCapture"
      className="cursor-pointer px-4 py-2 text-sm bg-[#0066CC] text-white rounded-lg hover:bg-[#004C99]"
    >
      Take Photo
    </label>
  </div>

  {/* Hidden inputs */}
  <input
    id="fileUpload"
    type="file"
    accept="image/*"
    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
    className="hidden"
  />

  <input
    id="cameraCapture"
    type="file"
    accept="image/*"
    capture="environment"
    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
    className="hidden"
  />

  <p className="text-xs text-gray-500 mt-2">
    Choose an image from your device or take a new photo
  </p>
</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-[#0066CC] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">KYC Status: {user?.kyc_verified ? 'Verified' : 'Not Verified'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user?.kyc_verified
                  ? 'Your identity has been verified. You have full access to all features.'
                  : 'Providing your National ID helps verify your identity for loan applications.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-500">Choose how you want to be notified about group activity.</p>
          {[
            { key: 'sms', label: 'SMS Reminders', desc: 'Receive SMS for upcoming contribution due dates', value: smsReminders, set: setSmsReminders },
            { key: 'push', label: 'Push Notifications', desc: 'In-app alerts for approvals, payments, and messages', value: pushNotifications, set: setPushNotifications },
            { key: 'loan', label: 'Loan Alerts', desc: 'Notifications when loans are approved or require action', value: loanAlerts, set: setLoanAlerts },
          ].map(({ key, label, desc, value, set }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <button
                onClick={() => set(!value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#0066CC]' : 'bg-gray-300'}`}
                role="switch"
                aria-checked={value}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> SMS notifications require integration with Uganda telecom providers (MTN, Airtel). Currently running in demo mode — actual SMS delivery requires Twilio or Africa's Talking API configuration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

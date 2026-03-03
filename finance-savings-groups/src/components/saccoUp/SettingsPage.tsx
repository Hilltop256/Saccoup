import React, { useState } from 'react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    groupName: 'Kampala Women Savings Club',
    groupType: 'savings_club',
    contributionAmount: '50000',
    contributionSchedule: 'monthly',
    interestRate: '5',
    interestType: 'flat',
    lateFee: '5000',
    gracePeriod: '3',
    maxLoanAmount: '500000',
    loanInterestRate: '5',
    requireGuarantors: true,
    minGuarantors: '1',
    language: 'en',
    smsReminders: true,
    pushNotifications: true,
    twoFactorAuth: false,
    umraCompliance: false,
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'financial', label: 'Financial', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'notifications', label: 'Notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
    { id: 'security', label: 'Security', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Configure your group rules and preferences</p>
        </div>
        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors flex items-center gap-2">
          {saved ? (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved!</>
          ) : (
            <>Save Changes</>
          )}
        </button>
      </div>

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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">General Settings</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name</label>
              <input type="text" value={settings.groupName} onChange={(e) => setSettings({...settings, groupName: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Group Type</label>
              <select value={settings.groupType} onChange={(e) => setSettings({...settings, groupType: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
                <option value="savings_club">Savings Club</option>
                <option value="investment_club">Investment Club</option>
                <option value="sacco">SACCO</option>
                <option value="rosca">ROSCA</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Language</label>
              <select value={settings.language} onChange={(e) => setSettings({...settings, language: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
                <option value="en">English</option>
                <option value="lg">Luganda</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Schedule</label>
              <select value={settings.contributionSchedule} onChange={(e) => setSettings({...settings, contributionSchedule: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.umraCompliance} onChange={(e) => setSettings({...settings, umraCompliance: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]" />
              <div>
                <span className="text-sm font-medium text-gray-700">UMRA Compliance Reporting</span>
                <p className="text-xs text-gray-500">Enable Uganda Microfinance Regulatory Authority reporting</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Financial Settings */}
      {activeTab === 'financial' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Financial Settings</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contribution Amount (UGX)</label>
              <input type="number" value={settings.contributionAmount} onChange={(e) => setSettings({...settings, contributionAmount: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Savings Interest Rate (%)</label>
              <input type="number" value={settings.interestRate} onChange={(e) => setSettings({...settings, interestRate: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Late Payment Fine (UGX)</label>
              <input type="number" value={settings.lateFee} onChange={(e) => setSettings({...settings, lateFee: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Grace Period (days)</label>
              <input type="number" value={settings.gracePeriod} onChange={(e) => setSettings({...settings, gracePeriod: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Max Loan Amount (UGX)</label>
              <input type="number" value={settings.maxLoanAmount} onChange={(e) => setSettings({...settings, maxLoanAmount: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Loan Interest Rate (%)</label>
              <input type="number" value={settings.loanInterestRate} onChange={(e) => setSettings({...settings, loanInterestRate: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Interest Type</label>
              <select value={settings.interestType} onChange={(e) => setSettings({...settings, interestType: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none bg-white">
                <option value="flat">Flat Rate</option>
                <option value="reducing_balance">Reducing Balance</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Min. Guarantors</label>
              <input type="number" value={settings.minGuarantors} onChange={(e) => setSettings({...settings, minGuarantors: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.requireGuarantors} onChange={(e) => setSettings({...settings, requireGuarantors: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]" />
            <span className="text-sm font-medium text-gray-700">Require guarantors for loan applications</span>
          </label>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Notification Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">SMS Reminders</span>
                <p className="text-xs text-gray-500">Send SMS reminders for upcoming contributions</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.smsReminders ? 'bg-[#0066CC]' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, smsReminders: !settings.smsReminders})}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.smsReminders ? 'translate-x-5.5 left-[22px]' : 'left-0.5'}`} />
              </div>
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                <p className="text-xs text-gray-500">Send push notifications for approvals and alerts</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.pushNotifications ? 'bg-[#0066CC]' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, pushNotifications: !settings.pushNotifications})}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.pushNotifications ? 'left-[22px]' : 'left-0.5'}`} />
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Security Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">Two-Factor Authentication (2FA)</span>
                <p className="text-xs text-gray-500">Require 2FA for admin and treasurer logins</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.twoFactorAuth ? 'bg-[#0066CC]' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, twoFactorAuth: !settings.twoFactorAuth})}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.twoFactorAuth ? 'left-[22px]' : 'left-0.5'}`} />
              </div>
            </label>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Audit Log</h3>
              <p className="text-xs text-gray-500 mb-3">All financial transactions and admin actions are automatically logged.</p>
              <button className="px-3 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors">View Audit Log</button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Data Export</h3>
              <p className="text-xs text-gray-500 mb-3">Export all group data for backup or regulatory compliance.</p>
              <button className="px-3 py-1.5 text-xs font-medium text-[#0066CC] bg-[#0066CC]/10 rounded-lg hover:bg-[#0066CC]/20 transition-colors">Export All Data</button>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <h3 className="text-sm font-medium text-red-700 mb-2">Danger Zone</h3>
              <p className="text-xs text-red-600 mb-3">Permanently delete this group and all associated data.</p>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">Delete Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

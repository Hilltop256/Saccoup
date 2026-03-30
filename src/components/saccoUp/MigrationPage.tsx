import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const MIGRATION_SQL = `-- SaccoUp: Add repaid_amount column to loans table
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;`;

const MigrationPage: React.FC = () => {
  const [repaidAmountExists, setRepaidAmountExists] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkColumn = async () => {
    setChecking(true);
    const { error } = await supabase.from('loans').select('repaid_amount').limit(1);
    setRepaidAmountExists(!error);
    setChecking(false);
  };

  useEffect(() => { checkColumn(); }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Database Migration</h1>
        <p className="text-sm text-gray-500">Check and apply pending database migrations</p>
      </div>

      {/* Status */}
      <div className={`rounded-xl border p-6 ${
        repaidAmountExists === null ? 'bg-gray-50 border-gray-200'
          : repaidAmountExists ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          {checking ? (
            <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : repaidAmountExists ? (
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          )}
          <div>
            <h3 className="font-bold text-gray-900">
              {checking ? 'Checking...' : repaidAmountExists ? 'All migrations applied' : 'Migration needed: loans.repaid_amount'}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {checking ? 'Checking database schema...'
                : repaidAmountExists ? 'The database is up to date. Loan repayment tracking is enabled.'
                : 'The loans table is missing the repaid_amount column. Loan repayment tracking is disabled until this column is added.'}
            </p>
          </div>
        </div>
        {!checking && (
          <button onClick={checkColumn} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800">
            Re-check
          </button>
        )}
      </div>

      {/* Migration instructions */}
      {!repaidAmountExists && !checking && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">How to Apply</h2>

          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Open your Supabase Dashboard</p>
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0066CC] hover:underline">
                  supabase.com/dashboard →
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p className="text-sm font-medium text-gray-900">Select your project → Go to <strong>SQL Editor</strong></p>
            </div>
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Paste and run this SQL:</p>
                <div className="mt-2 bg-gray-900 rounded-lg p-4 relative">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{MIGRATION_SQL}</pre>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <p className="text-sm font-medium text-gray-900">Click <strong>Re-check</strong> above to verify</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationPage;

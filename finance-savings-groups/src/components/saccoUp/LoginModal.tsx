import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  mode: 'login' | 'register';
}

// Uganda telecom prefixes for validation
const UG_MTN_PREFIXES = ['76', '77', '78', '39'];
const UG_AIRTEL_PREFIXES = ['70', '75', '74'];
const ALL_UG_PREFIXES = [...UG_MTN_PREFIXES, ...UG_AIRTEL_PREFIXES];

function detectUgNetwork(phone: string): 'MTN' | 'Airtel' | null {
  const digits = phone.replace(/\D/g, '');
  // Strip leading 0 or 256
  const local = digits.startsWith('256') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  const prefix = local.substring(0, 2);
  if (UG_MTN_PREFIXES.includes(prefix)) return 'MTN';
  if (UG_AIRTEL_PREFIXES.includes(prefix)) return 'Airtel';
  return null;
}

function validateUgPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('256') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length !== 9) return 'Enter a valid 9-digit Uganda phone number';
  const prefix = local.substring(0, 2);
  if (!ALL_UG_PREFIXES.includes(prefix)) return 'Number must start with 7 (MTN/Airtel Uganda)';
  return null;
}

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, mode: initialMode }) => {
  const { login, register, verifyOtp, resendOtp } = useAppContext();
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setStep('credentials');
    setError('');
    setOtpCode('');
    setDemoOtp('');
    setPhone('');
    setPin('');
    setName('');
    setConfirmPin('');
    setInviteCode('');
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  const network = detectUgNetwork(phone);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone
    const phoneError = validateUgPhone(phone);
    if (phoneError) { setError(phoneError); return; }

    if (!pin) { setError('Please enter your PIN'); return; }

    if (mode === 'register') {
      if (!name.trim()) { setError('Please enter your full name'); return; }
      if (name.trim().split(' ').length < 2) { setError('Please enter your first and last name'); return; }
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
      if (!/^\d+$/.test(pin)) { setError('PIN must contain only numbers'); return; }
    }

    setLoading(true);
    try {
      const result = mode === 'register'
        ? await register(phone, pin, name.trim(), inviteCode.trim() || undefined)
        : await login(phone, pin);

      if (result.success && result.phone) {
        setVerifiedPhone(result.phone);
        setDemoOtp(result.demoOtp || '');
        setStep('otp');
        setResendCooldown(30);
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpCode || otpCode.length < 6) { setError('Please enter the 6-digit OTP code'); return; }
    setLoading(true);
    try {
      const result = await verifyOtp(verifiedPhone, otpCode);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || 'Verification failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    const result = await resendOtp(verifiedPhone);
    if (result.success) {
      setDemoOtp(result.demoOtp || '');
      setResendCooldown(60);
      setError('');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] px-6 py-8 text-center relative">
          {step === 'otp' && (
            <button
              onClick={() => { setStep('credentials'); setError(''); setOtpCode(''); }}
              className="absolute left-4 top-4 p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            {step === 'credentials' ? (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-6 3.75h.008v.008H7.5v-.008zm3 0h.008v.008H10.5v-.008zm3 0h.008v.008H13.5v-.008z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {step === 'otp' ? 'Verify Your Phone' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-blue-200 mt-1">
            {step === 'otp'
              ? `OTP sent to ${verifiedPhone}`
              : mode === 'login'
              ? 'Sign in to your SaccoUp account'
              : 'Join SaccoUp — save and grow together'}
          </p>
        </div>

        {/* Credentials Step */}
        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="p-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                  placeholder="e.g. Sarah Nakamya"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2.5 text-sm font-medium text-gray-500 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg whitespace-nowrap">
                  🇺🇬 +256
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-r-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none font-mono"
                  placeholder="7XX XXX XXX"
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>
              {/* Network indicator */}
              {phone.length >= 2 && (
                <p className={`text-xs mt-1 ${network ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {network ? `${network === 'MTN' ? '📲 MTN' : '📲 Airtel'} Uganda number detected` : '⚠️ Enter a valid Uganda number (07X or +2567X)'}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                PIN {mode === 'register' ? '(4-6 digits)' : ''}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none tracking-[0.5em] font-mono"
                placeholder="••••"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Confirm PIN *</label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none tracking-[0.5em] font-mono ${
                      confirmPin && pin !== confirmPin ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="••••"
                    autoComplete="new-password"
                  />
                  {confirmPin && pin !== confirmPin && (
                    <p className="text-xs text-red-500 mt-1">PINs do not match</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Invite Code <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none font-mono uppercase tracking-widest"
                    placeholder="e.g. KWS2026A"
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-400 mt-1">Join an existing group during registration</p>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner />Processing...</> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-sm text-[#0066CC] hover:underline"
              >
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <div className="flex-1 h-px bg-gray-100" />
              <p className="text-xs text-gray-400 whitespace-nowrap">USSD: Dial *123# on feature phones</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          </form>
        ) : (
          /* OTP Verification Step */
          <form onSubmit={handleOtpVerify} className="p-6 space-y-4">
            {demoOtp && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs font-semibold text-amber-700">Demo Mode — Your OTP:</p>
                </div>
                <p className="text-3xl font-bold text-amber-900 tracking-[0.4em] font-mono">{demoOtp}</p>
                <p className="text-[10px] text-amber-500 mt-2">In production, this is sent via SMS to {verifiedPhone}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">6-Digit Verification Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="w-full px-4 py-4 text-center text-3xl font-mono font-bold tracking-[0.6em] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none"
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">
                Code expires in 10 minutes
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-3 text-sm font-semibold text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner />Verifying...</> : 'Verify & Continue'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm text-[#0066CC] hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;

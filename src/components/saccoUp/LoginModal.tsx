import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  mode: 'login' | 'register';
}

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

  useEffect(() => { setMode(initialMode); setStep('credentials'); setError(''); setOtpCode(''); setDemoOtp(''); }, [initialMode, isOpen]);
  useEffect(() => { if (resendCooldown > 0) { const t = setTimeout(() => setResendCooldown(c => c - 1), 1000); return () => clearTimeout(t); } }, [resendCooldown]);

  if (!isOpen) return null;

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || !pin) { setError('Please fill in all required fields'); return; }
    if (mode === 'register') {
      if (!name) { setError('Please enter your full name'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    }
    setLoading(true);
    try {
      const result = mode === 'register'
        ? await register(phone, pin, name, inviteCode || undefined)
        : await login(phone, pin);
      if (result.success && result.phone) {
        setVerifiedPhone(result.phone);
        setDemoOtp(result.demoOtp || '');
        setStep('otp');
        setResendCooldown(30);
      } else {
        setError(result.error || 'Something went wrong');
      }
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpCode || otpCode.length < 6) { setError('Please enter the 6-digit OTP code'); return; }
    setLoading(true);
    try {
      const result = await verifyOtp(verifiedPhone, otpCode);
      if (result.success) { onLogin(); }
      else { setError(result.error || 'Verification failed'); }
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const result = await resendOtp(verifiedPhone);
    if (result.success) { setDemoOtp(result.demoOtp || ''); setResendCooldown(30); setError(''); }
  };

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#0066CC] to-[#004C99] px-6 py-8 text-center relative">
          {step === 'otp' && (
            <button onClick={() => { setStep('credentials'); setError(''); setOtpCode(''); }} className="absolute left-4 top-4 p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
          )}
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            {step === 'credentials' ? (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {step === 'otp' ? 'Verify Your Phone' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-blue-200 mt-1">
            {step === 'otp' ? `Enter the 6-digit code sent to ${verifiedPhone}` : mode === 'login' ? 'Sign in to your SaccoUp dashboard' : 'Join SaccoUp and start saving together'}
          </p>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="p-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="Enter your full name" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg">+256</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-r-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="7XX XXX XXX" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">PIN</label>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="Enter 4-6 digit PIN" />
            </div>
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Confirm PIN</label>
                  <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={6} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="Confirm your PIN" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Invite Code (optional)</label>
                  <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="Enter group invite code" />
                </div>
              </>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full py-3 text-sm font-semibold text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
              {loading ? <><Spinner />Processing...</> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="text-sm text-[#0066CC] hover:underline">
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">USSD Access: Dial *123# for feature phone access</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify} className="p-6 space-y-4">
            {demoOtp && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 font-medium mb-1">Demo Mode - Your OTP code is:</p>
                <p className="text-2xl font-bold text-amber-800 tracking-[0.3em] font-mono">{demoOtp}</p>
                <p className="text-[10px] text-amber-500 mt-1">In production, this would be sent via SMS</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Verification Code</label>
              <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none" placeholder="000000" autoFocus />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || otpCode.length < 6} className="w-full py-3 text-sm font-semibold text-white bg-[#0066CC] rounded-lg hover:bg-[#004C99] transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
              {loading ? <><Spinner />Verifying...</> : 'Verify & Sign In'}
            </button>
            <div className="text-center">
              <button type="button" onClick={handleResend} disabled={resendCooldown > 0} className="text-sm text-[#0066CC] hover:underline disabled:text-gray-400 disabled:no-underline">
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

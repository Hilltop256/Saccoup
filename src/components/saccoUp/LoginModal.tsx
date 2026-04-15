import React, { useState, useEffect, useRef } from 'react';
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

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSide = 200;
      const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
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
  const [nationalId, setNationalId] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [demoOtp, setDemoOtp] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setNationalId('');
    setEmail('');
    setDateOfBirth('');
    setPhotoDataUrl(null);
    setPhotoError('');
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

    const phoneError = validateUgPhone(phone);
    if (phoneError) return setError(phoneError);
    if (!pin) return setError('Please enter your PIN');

    if (mode === 'register') {
      if (!name.trim()) return setError('Please enter your full name');
      if (name.trim().split(' ').length < 2) return setError('Enter first and last name');
      if (pin.length < 4) return setError('PIN must be at least 4 digits');
      if (pin !== confirmPin) return setError('PINs do not match');
      if (!photoDataUrl) return setError('Please upload your profile photo');
      if (!nationalId.trim()) return setError('Enter National ID');
      if (!email.trim()) return setError('Enter email');
      if (!dateOfBirth) return setError('Enter date of birth');

      const parts = dateOfBirth.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (month < 1 || month > 12) return setError('Invalid month');
      if (day < 1 || day > 31) return setError('Invalid day');
    } // ✅ FIXED: properly closed register block here

    setLoading(true);

    try {
      const result =
        mode === 'register'
          ? await register(phone, pin, name.trim(), photoDataUrl || '', nationalId.trim(), email.trim(), dateOfBirth)
          : await login(phone, pin);

      if (result.success && result.phone) {
        setVerifiedPhone(result.phone);
        setDemoOtp(result.demoOtp || '');
        setStep('otp');
        setResendCooldown(30);
      } else {
        setError(result.error || 'Something went wrong');
      }
    } catch {
      setError('Network error');
    }

    setLoading(false);
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.length < 6) return setError('Enter valid OTP');

    setLoading(true);
    const result = await verifyOtp(verifiedPhone, otpCode);

    if (result.success) onLogin();
    else setError(result.error || 'Verification failed');

    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);

    const result = await resendOtp(verifiedPhone);
    if (result.success) {
      setDemoOtp(result.demoOtp || '');
      setResendCooldown(60);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-2 pt-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        <div className="p-6 text-center bg-gradient-to-r from-purple-600 to-pink-500 text-white">
          <h2 className="text-xl font-bold">
            {step === 'otp' ? 'Verify Phone' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="p-6 space-y-4">
            <input
              placeholder="Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border p-2 rounded"
            />

            <input
              placeholder="PIN"
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full border p-2 rounded"
            />

            {mode === 'register' && (
              <>
                <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
                <input placeholder="Confirm PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
                <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input placeholder="DOB DD/MM/YYYY" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
              </>
            )}

            {error && <p className="text-red-500">{error}</p>}

            <button disabled={loading} className="w-full bg-purple-600 text-white p-2 rounded">
              {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify} className="p-6 space-y-4">
            <input
              placeholder="OTP"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              className="w-full border p-2 rounded text-center"
            />

            <button className="w-full bg-green-600 text-white p-2 rounded">
              Verify
            </button>

            <button type="button" onClick={handleResend} className="text-sm text-purple-600">
              Resend OTP
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;

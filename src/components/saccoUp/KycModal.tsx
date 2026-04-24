import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';

const KycModal = () => {
  const { user, logout, needsSetup } = useAppContext();
  
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [pin, setPin] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If there is no user or they don't need setup, don't show the modal
  if (!user || !needsSetup) return null;

  // 🔐 Hash PIN - Must match AppContext salt
  const hashPin = async (pin: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'saccoup2026'); 
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // 📸 Upload Image to Supabase Storage
  const uploadPhoto = async (file: File) => {
    const filePath = `profiles/${user.member_id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async () => {
    setError('');

    // 1. Validation
    if (!email || !nationalId || !pin || !photo) {
      setError('All fields (Email, National ID, PIN, and Photo) are required.');
      return;
    }

    if (pin === '0000') {
      setError('You must change your PIN from the default "0000".');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }

    try {
      setLoading(true);

      // 2. Upload photo
      const photoUrl = await uploadPhoto(photo);

      // 3. Hash PIN
      const pinHash = await hashPin(pin);

      // 4. Update Members Table
      // This uses the UUID that identifies the person
      const { error: memberError } = await supabase
        .from('members')
        .update({
          email,
          national_id: nationalId,
          photo_url: photoUrl,
          kyc_verified: true,
        })
        .eq('id', user.member_id); 

      if (memberError) throw memberError;

      // 5. Update User Accounts Table
      // This uses the UUID that identifies the login credentials
      const { error: accountError } = await supabase
        .from('user_accounts')
        .update({
          pin_hash: pinHash,
        })
        .eq('id', user.id);

      if (accountError) throw accountError;

      // 6. Refresh the app to clear the modal and show dashboard
      window.location.reload(); 

    } catch (err: any) {
      console.error("KYC_ERROR:", err);
      setError(err.message || 'Something went wrong while saving your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <h2 className="text-2xl font-bold">Account Setup</h2>
          <p className="text-blue-100 text-sm mt-1">
            Please complete your profile details to access your dashboard.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-medium p-3 rounded-xl flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. name@example.com"
                className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">National ID Number</label>
              <input
                type="text"
                placeholder="Enter NIN"
                className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">New Secure PIN</label>
              <input
                type="password"
                maxLength={6}
                placeholder="Set a new 4-6 digit PIN"
                className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Profile Photo</label>
              <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-blue-400 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm text-blue-600 font-medium">
                    {photo ? photo.name : "Click to upload photo"}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 active:transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
          >
            {loading ? "Saving Details..." : 'Secure My Account'}
          </button>
          
          <button 
            onClick={logout}
            className="w-full text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors"
          >
            Cancel and Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default KycModal;

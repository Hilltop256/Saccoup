import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';

const KycModal = () => {
  const { user, refreshUser, setNeedsKyc } = useAppContext();

  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [pin, setPin] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  // 🔐 Hash PIN
  const hashPin = async (pin: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // 📸 Upload Image
  const uploadPhoto = async (file: File) => {
    const filePath = `profiles/${user.id}_${Date.now()}`;

    const { error } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async () => {
    setError('');

    if (!email || !nationalId || !pin || !photo) {
      setError('All fields are required');
      return;
    }

    if (pin === '0000') {
      setError('Default PIN is not allowed');
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Upload photo
      const photoUrl = await uploadPhoto(photo);

      // 2️⃣ Hash PIN
      const pinHash = await hashPin(pin);

      // 3️⃣ Update members table
      const { error: memberError } = await supabase
        .from('members')
        .update({
          email,
          national_id: nationalId,
          photo_url: photoUrl,
          kyc_verified: true,
        })
        .eq('id', user.id);

      if (memberError) throw memberError;

      // 4️⃣ Update user_accounts table
      const { error: accountError } = await supabase
        .from('user_accounts')
        .update({
          pin_hash: pinHash,
        })
        .eq('member_id', user.id);

      if (accountError) throw accountError;

      // 5️⃣ Refresh user + close modal
      await refreshUser();
      setNeedsKyc(false);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 animate-fadeIn">
        
        {/* Header */}
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          Complete Your Profile
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          For security, please update your details before continuing.
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          
          <input
            type="email"
            placeholder="Email Address"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="text"
            placeholder="National ID"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
          />

          <input
            type="password"
            placeholder="New PIN"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            className="w-full text-sm"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Complete Setup'}
        </button>

      </div>
    </div>
  );
};

export default KycModal;

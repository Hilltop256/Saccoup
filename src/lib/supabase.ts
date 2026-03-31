import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  const msg = `Missing Supabase env vars. URL=${supabaseUrl ? 'set' : 'MISSING'}, KEY=${supabaseKey ? 'set' : 'MISSING'}. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Settings → Environment Variables, then redeploy.`;
  console.error('[SaccoUp]', msg);
  throw new Error(msg);
}

const cleanUrl = supabaseUrl.trim();
const cleanKey = supabaseKey.trim();

// Runtime diagnostic (visible in browser console on Vercel)
console.log('[SaccoUp] Supabase URL:', cleanUrl);
console.log('[SaccoUp] API key length:', cleanKey.length, '| starts with:', cleanKey.substring(0, 20) + '...');

// Validate key format (JWT should be 3 parts separated by dots)
const jwtParts = cleanKey.split('.');
if (jwtParts.length !== 3) {
  console.error('[SaccoUp] API key does not look like a valid JWT. Got', jwtParts.length, 'parts instead of 3.');
}

const supabase = createClient(cleanUrl, cleanKey);

export { supabase };

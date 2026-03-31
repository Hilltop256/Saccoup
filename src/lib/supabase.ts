import { createClient } from '@supabase/supabase-js';

// Use env vars if set, otherwise fall back to defaults
// For production, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Settings
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://hfashvzkvohylakpwisc.supabase.co').trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYXNodnprdm9oeWxha3B3aXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTI2MTUsImV4cCI6MjA4ODEyODYxNX0.-3LhPuRJl5UJyd1JfXbG6HU39kvMUM7hDoYkhg5blrc').trim();

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };

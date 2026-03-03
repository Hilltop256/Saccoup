import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://hfashvzkvohylakpwisc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYXNodnprdm9oeWxha3B3aXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTI2MTUsImV4cCI6MjA4ODEyODYxNX0.-3LhPuRJl5UJyd1JfXbG6HU39kvMUM7hDoYkhg5blrc';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };
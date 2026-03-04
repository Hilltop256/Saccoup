import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://wrmqvzalfguenvmtczwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndybXF2emFsZmd1ZW52bXRjendvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjI3MzMsImV4cCI6MjA4NjYzODczM30.KK7-Hq3slvSix5mj74f-DXZX_pJNHQI3qF4-4J4XSnc';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };
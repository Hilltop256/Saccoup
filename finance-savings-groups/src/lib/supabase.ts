import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://hvlhcexrwdfxddtkxzlf.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc3YWJjNGU3LTJlNDctNDJiMi04OGJiLTljYTAyNWQ5Yzc3NSJ9.eyJwcm9qZWN0SWQiOiJodmxoY2V4cndkZnhkZHRreHpsZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcxMDcyOTI5LCJleHAiOjIwODY0MzI5MjksImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.1OFlRFHVxz3TeWYTSQIo5EwE8jBrA02M5EB82zNSI0Y';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };
import { createClient } from '@supabase/supabase-js';

const url = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjA2NTksImV4cCI6MjA2NzczNjY1OX0.NvBEq1Nofeu04OMRtd7Bwn_Je5MkmALSIm3kN-HkT0Y';

const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = 'realtime-test@example.com';
const password = 'Testing123!';

const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});
if (userError && userError.message !== 'User already registered') {
  console.error('createUser error', userError);
} else {
  console.log('user ok');
}

const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error('signIn error', signInError);
  process.exit(1);
}
console.log('session', signInData.session?.access_token?.slice(0,32));

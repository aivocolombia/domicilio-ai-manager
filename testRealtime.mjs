import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjA2NTksImV4cCI6MjA2NzczNjY1OX0.NvBEq1Nofeu04OMRtd7Bwn_Je5MkmALSIm3kN-HkT0Y';

const supabase = createClient(supabaseUrl, supabaseKey);

const channel = supabase.channel('test_cli')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, payload => {
    console.log('payload', payload.eventType);
  })
  .subscribe(status => {
    console.log('status', status);
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      process.exit(1);
    }
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed ok');
      setTimeout(() => {
        channel.unsubscribe();
        process.exit(0);
      }, 2000);
    }
  });

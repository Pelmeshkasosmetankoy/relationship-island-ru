import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'Supabase env vars are missing. Create a .env file from .env.example ' +
    'and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Fall back to placeholder values so createClient() never throws at module load —
// a missing/invalid URL would otherwise crash before React mounts, showing a blank screen.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');

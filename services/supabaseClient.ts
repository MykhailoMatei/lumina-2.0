
import { createClient } from '@supabase/supabase-js';

// Your Project Details with optional env overrides for Vercel / production
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || 'https://woxthjwqqlpmnlqtpced.supabase.co';
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NFIu48_HmmoIBixfMjBdbw_vYWN1bRo';

// Helper to determine if we have a valid cloud configuration
export const isSupabaseConfigured = 
    supabaseUrl && 
    supabaseUrl !== 'https://your-project-url.supabase.co' && 
    supabaseAnonKey !== 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

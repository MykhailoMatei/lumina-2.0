
import { createClient } from '@supabase/supabase-js';

// Your Project Details
const supabaseUrl: string = 'https://woxthjwqqlpmnlqtpced.supabase.co';
const supabaseAnonKey: string = 'sb_publishable_NFIu48_HmmoIBixfMjBdbw_vYWN1bRo';

// Helper to determine if we have a valid cloud configuration
export const isSupabaseConfigured = 
    supabaseUrl && 
    supabaseUrl !== 'https://your-project-url.supabase.co' && 
    supabaseAnonKey !== 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


/**
 * Supabase Edge Function: send-push-nudge
 * This script runs on Supabase (Deno runtime) and sends the actual push notification.
 */

// @ts-ignore: Deno is available in the Supabase Edge Function runtime
declare const Deno: any;

// @ts-ignore: URL imports are supported in Deno/Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore: URL imports are supported in Deno/Supabase Edge Functions
import webpush from 'https://esm.sh/web-push@3.6.6';

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:support@lumina.app';

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isService = Boolean(token && serviceRoleKey && token === serviceRoleKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey, // Use Service Role for internal database operations
    );

    const body = await req.json();
    const { type, user_id, phase } = body;

    // Scheduled Cron/Routine Phase Nudge Mode (targeted by user local time)
    if (type === 'routine_nudge' && phase && isService) {
      const { data: usersToNudge, error: rpcError } = await supabase
        .rpc('get_users_for_routine_nudge', { target_phase: phase });

      if (rpcError) throw rpcError;

      let sentCount = 0;
      const phaseTitles: Record<string, string> = {
        Morning: 'Morning Routine ✨',
        Afternoon: 'Afternoon Check-in 🌿',
        Evening: 'Evening Reflection 🌙'
      };
      const title = phaseTitles[phase] || 'Time for your ritual';
      const payload = JSON.stringify({
        title,
        body: `It's your scheduled ${phase.toLowerCase()} ritual time. Step into your next micro-habit.`,
        tag: `lumina-routine-${phase.toLowerCase()}`
      });

      for (const item of (usersToNudge || [])) {
        try {
          // Double-check: ensure the user hasn't completed all active habits for this phase today
          const { data: habitsForPhase } = await supabase
            .from('habits')
            .select('completed_dates')
            .eq('user_id', item.user_id)
            .eq('time_of_day', phase)
            .is('deleted_at', null);

          if (habitsForPhase && habitsForPhase.length > 0) {
            // Determine today's date in user's timezone if provided, or UTC fallback
            const userTz = item.user_timezone || 'UTC';
            let todayInUserTz: string;
            try {
              todayInUserTz = new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(new Date());
            } catch {
              todayInUserTz = new Date().toISOString().split('T')[0];
            }

            const allCompleted = habitsForPhase.every((h: any) => {
              const dates = Array.isArray(h.completed_dates) ? h.completed_dates : [];
              return dates.includes(todayInUserTz);
            });

            // If user has active habits for this phase and finished all of them, skip push
            if (allCompleted) {
              continue;
            }
          }

          await webpush.sendNotification(item.subscription, payload);
          sentCount++;
        } catch (pushErr: any) {
          const statusCode = Number(pushErr?.statusCode || pushErr?.status || pushErr?.code);
          if (statusCode === 410 || statusCode === 404) {
            await supabase.from('user_push_subscriptions').delete().eq('user_id', item.user_id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, nudgedCount: sentCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetUserId = user_id;

    // Security Check: Only service role can notify other users arbitrarily
    if (user_id && !isService) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user || user.id !== user_id) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only notify yourself' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      targetUserId = user.id;
    } else if (!targetUserId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      targetUserId = user.id;
    }

    // 1. Fetch the user's specific push subscription
    const { data: subData, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('subscription')
      .eq('user_id', targetUserId)
      .single();

    if (subError || !subData) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const payload = JSON.stringify({
      title: type === 'test' ? 'Lumina Link Integrity' : 'Your Growth Awaits',
      body: type === 'test' ? 'Backend signal received. Sync active! 🚀' : 'Time for your scheduled ritual.',
    });

    // 2. Fire the push notification with cleanup on expired subscription (410/404)
    try {
      await webpush.sendNotification(subData.subscription, payload);
    } catch (pushErr: any) {
      const statusCode = Number(pushErr?.statusCode || pushErr?.status || pushErr?.code);
      if (statusCode === 410 || statusCode === 404) {
        // Clean up expired or unregistered subscription
        await supabase.from('user_push_subscriptions').delete().eq('user_id', targetUserId);
      }
      throw pushErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

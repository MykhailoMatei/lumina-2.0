
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

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use Service Role for internal calls
    );

    const body = await req.json();
    const { type, user_id } = body;
    let targetUserId = user_id;

    // If no user_id is passed (Frontend call), get it from the JWT
    if (!targetUserId) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return new Response('Unauthorized', { status: 401 });
        targetUserId = user.id;
    }

    // 1. Fetch the user's specific push subscription
    const { data: subData, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('subscription')
      .eq('user_id', targetUserId)
      .single();

    if (subError || !subData) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), { status: 404 });
    }

    const payload = JSON.stringify({
      title: type === 'test' ? 'Lumina Link Integrity' : 'Your Growth Awaits',
      body: type === 'test' ? 'Backend signal received. Sync active! 🚀' : 'Time for your scheduled ritual.',
    });

    // 2. Fire the push notification
    await webpush.sendNotification(subData.subscription, payload);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
});

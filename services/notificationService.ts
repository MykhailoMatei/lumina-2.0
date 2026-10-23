
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Lumina Secure Push Service
 * 
 * VAPID Public Key injected for misha25611@gmail.com
 */
const VAPID_PUBLIC_KEY = "BPf3vFoDQN1Y8666AFPsG9xWZgpB3sXIZ81aT8Ff5LyUnxDRdK_oQcKBIv6wOr7Bj2sgrajxUZZCkpox51YxjCw"; 

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported' | 'prompt';

export const requestNotificationPermission = async (): Promise<PermissionResult> => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    
    try {
        const permission = await Notification.requestPermission();
        return permission as PermissionResult;
    } catch (e) {
        console.error("Permission request failed", e);
        return 'denied';
    }
};

/**
 * Creates the "Digital Mailbox" for the device and stores it in Supabase
 */
export const subscribeToPush = async (userId: string | null) => {
    if (!('serviceWorker' in navigator) || !userId || !isSupabaseConfigured) return null;

    try {
        const registration = await navigator.serviceWorker.ready;
        
        let subscription = await registration.pushManager.getSubscription();
        
        // If no subscription exists, or if we have a key but weren't using it, re-subscribe
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        if (subscription) {
            // Save to the table 'user_push_subscriptions'
            const { error } = await supabase.from('user_push_subscriptions').upsert({
                user_id: userId,
                subscription: subscription.toJSON(),
                updated_at: new Date().toISOString()
            });

            if (error) throw error;
        }
        
        return subscription;
    } catch (e) {
        console.error("Push Link Failed. Check VAPID Public Key and Browser permissions.", e);
        return null;
    }
};

export const triggerBackendTestNudge = async () => {
    if (!isSupabaseConfigured) return { error: 'Supabase not linked' };
    try {
        // This calls the Edge Function 'send-push-nudge'
        const { data, error } = await supabase.functions.invoke('send-push-nudge', {
            body: { type: 'test' }
        });
        return { data, error };
    } catch (e: any) {
        return { error: e.message };
    }
};

export const sendSystemNotification = async (title: string, options?: NotificationOptions): Promise<'success' | 'denied' | 'error'> => {
    if (!('Notification' in window)) return 'error';
    if (Notification.permission !== 'granted') return 'denied';

    const defaultOptions: any = {
        icon: 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png',
        vibrate: [200, 100, 200],
        tag: 'lumina-nudge',
        renotify: true,
        ...options
    };

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.showNotification(title, defaultOptions);
                return 'success';
            }
        } catch (e) { console.warn("SW Nudge failed", e); }
    }

    try {
        new Notification(title, defaultOptions);
        return 'success';
    } catch (e) { return 'error'; }
};

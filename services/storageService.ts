import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Converts a Base64 string or DataURL to a Blob for uploading.
 */
const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

/**
 * Uploads an image to a Supabase storage bucket and returns an accessible display URL.
 * Strictly adheres to Supabase RLS by storing files in a user-scoped folder: ${userId}/...
 */
export const uploadImage = async (
    bucket: 'avatars' | 'journal',
    path: string,
    base64Data: string
): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;

    try {
        const blob = dataURLtoBlob(base64Data);
        // Ensure path starts with the user ID folder so (storage.foldername(name))[1] is the user ID to pass RLS
        let fullPath = path;
        if (!fullPath.includes('/')) {
            fullPath = `${fullPath}/${bucket === 'avatars' ? 'avatar' : Date.now()}`;
        }
        const fileName = fullPath.endsWith('.jpg') || fullPath.endsWith('.png') || fullPath.endsWith('.jpeg')
            ? fullPath
            : `${fullPath}.jpg`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        // If bucket is journal (private), store the durable storage path; signed URLs will be created on display
        if (bucket === 'journal') {
            return data.path;
        }

        // Avatars bucket is public, so getPublicUrl works
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        return publicUrl;
    } catch (e) {
        console.error(`Storage Error [${bucket}]:`, e);
        return null;
    }
};

/**
 * Resolves a signed URL for private journal storage paths if an expired or relative path is passed.
 */
const signedUrlCache = new Map<string, { url: string; expires: number }>();

export const getJournalImageSignedUrl = async (pathOrUrl: string): Promise<string> => {
    if (!pathOrUrl || !isSupabaseConfigured) return pathOrUrl;
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) return pathOrUrl;

    const now = Date.now();
    const cached = signedUrlCache.get(pathOrUrl);
    if (cached && now < cached.expires) {
        return cached.url;
    }

    try {
        let storagePath = pathOrUrl;
        if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
            const match = pathOrUrl.match(/\/journal\/(.*?)(\?|$)/);
            if (match && match[1]) {
                storagePath = decodeURIComponent(match[1]);
            } else {
                return pathOrUrl;
            }
        }

        const { data, error } = await supabase.storage.from('journal').createSignedUrl(storagePath, 60 * 60 * 24);
        if (!error && data?.signedUrl) {
            signedUrlCache.set(pathOrUrl, { url: data.signedUrl, expires: now + 23 * 60 * 60 * 1000 });
            return data.signedUrl;
        }
        return pathOrUrl;
    } catch {
        return pathOrUrl;
    }
};

const _unusedLegacySign = async (pathOrUrl: string) => {
    if (!pathOrUrl || !isSupabaseConfigured) return pathOrUrl;
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) return pathOrUrl;

    try {
        // If it's a relative storage path (e.g. "userId/12345.jpg")
        if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
            const { data } = await supabase.storage.from('journal').createSignedUrl(pathOrUrl, 60 * 60 * 24 * 365);
            return data?.signedUrl || pathOrUrl;
        }
        return pathOrUrl;
    } catch {
        return pathOrUrl;
    }
};

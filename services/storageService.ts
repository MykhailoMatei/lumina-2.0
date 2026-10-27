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

        // If bucket is journal (private), generate a long-lived signed URL (1 year) so it loads in <img> tags
        if (bucket === 'journal') {
            const { data: signedData, error: signError } = await supabase.storage
                .from(bucket)
                .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year
            
            if (!signError && signedData?.signedUrl) {
                return signedData.signedUrl;
            }
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
export const getJournalImageSignedUrl = async (pathOrUrl: string): Promise<string> => {
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

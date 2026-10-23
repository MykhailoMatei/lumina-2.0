
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Converts a Base64 string or DataURL to a Blob for uploading.
 */
const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

/**
 * Uploads an image to a Supabase storage bucket and returns the public URL.
 */
export const uploadImage = async (
    bucket: 'avatars' | 'journal',
    path: string,
    base64Data: string
): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;

    try {
        const blob = dataURLtoBlob(base64Data);
        const fileName = `${path}-${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        return publicUrl;
    } catch (e) {
        console.error(`Storage Error [${bucket}]:`, e);
        return null;
    }
};

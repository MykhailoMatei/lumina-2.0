import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, getAdminClient } from '../_lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const admin = getAdminClient();
  if (!admin) {
    return res.status(500).json({ error: 'Account deletion is not configured on the server.' });
  }

  const userId = auth.user.id;
  try {
    const tables = ['goals', 'habits', 'journal_entries', 'user_push_subscriptions'];
    const results = await Promise.all(tables.map((t) => admin.from(t).delete().eq('user_id', userId)));
    const failed = results.find((r: any) => r.error);
    if (failed) throw failed.error;

    for (const bucket of ['avatars', 'journal']) {
      const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map((f: any) => `${userId}/${f.name}`));
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return res.json({ success: true });
  } catch (e: any) {
    console.error('[account-delete]', e);
    return res.status(500).json({ error: e?.message || 'Failed to delete account' });
  }
}
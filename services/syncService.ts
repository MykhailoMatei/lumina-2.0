
import { UserState, Goal, Habit, JournalEntry } from "../types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Lumina Sync Service - Master snake_case Alignment
 * Maps camelCase frontend types to the snake_case Supabase columns.
 */

const mapHabitToDb = (h: Habit) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    trigger: h.trigger || null,
    description: h.description || null,
    duration: h.duration || null,
    time_of_day: h.timeOfDay,
    days_of_week: Array.isArray(h.daysOfWeek) ? h.daysOfWeek : [],
    schedule_type: h.scheduleType || 'weekly',
    monthly_days: Array.isArray(h.monthlyDays) ? h.monthlyDays : [],
    reminder_time: h.reminderTime || null,
    linked_goal_id: h.linkedGoalId || null,
    streak: typeof h.streak === 'number' ? h.streak : 0,
    completed_dates: Array.isArray(h.completedDates) ? h.completedDates : [],
    target_amount: typeof h.targetAmount === 'number' ? h.targetAmount : null,
    target_unit: h.targetUnit || null,
    reward: h.reward ? (typeof h.reward === 'string' ? h.reward : JSON.stringify(h.reward)) : null,
    created_at: h.createdAt || new Date().toISOString(),
    last_updated: h.lastUpdated || Date.now()
});

const mapGoalToDb = (g: Goal) => ({
    id: g.id,
    title: g.title,
    why_statement: g.whyStatement || null,
    category: g.category,
    progress: typeof g.progress === 'number' ? g.progress : 0,
    deadline: g.deadline || null,
    completed: !!g.completed,
    milestones: Array.isArray(g.milestones) ? g.milestones : [],
    is_paused: !!g.isPaused,
    outcome_label: g.outcomeLabel || null,
    identity_impact: g.identityImpact || null,
    what_stayed: g.whatStayed || null,
    what_shifted: g.whatShifted || null,
    archived_at: g.archivedAt || null,
    start_date: g.startDate || null,
    last_updated: g.lastUpdated || Date.now()
});

const mapEntryToDb = (e: JournalEntry) => ({
    id: e.id,
    title: e.title || null,
    category: e.category || 'Daily',
    date: e.date,
    content: e.content || null,
    prompt: e.prompt || null,
    mood: e.mood,
    activities: Array.isArray(e.activities) ? e.activities : [],
    ai_insight: e.aiInsight || null,
    linked_goal_id: e.linkedGoalId || null,
    linked_habit_id: e.linkedHabitId || null,
    image_data: e.imageData || null,
    last_updated: e.lastUpdated || Date.now()
});

const mapFromDb = (item: any) => {
    const mapped: any = {};
    for (const key in item) {
        const camelKey = key.replace(/([-_][a-z])/g, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
        mapped[camelKey] = item[key];
    }
    return mapped;
};

export const performCloudSync = async (localData: UserState): Promise<{ success: boolean; data?: Partial<UserState>; message: string }> => {
    if (!isSupabaseConfigured) {
        return { success: false, message: "Supabase not configured." };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
        return { success: false, message: "Auth Session Required" };
    }

    const userId = session.user.id;

    try {
        // 1. Deletions: write deleted_at remotely (soft delete), falling back to hard delete
        const deletePromises: any[] = [];
        const nowIso = new Date().toISOString();
        const nowTs = Date.now();

        if (localData.deletedIds?.goals?.length > 0) {
            deletePromises.push(
                supabase.from('goals').update({ deleted_at: nowIso, last_updated: nowTs }).in('id', localData.deletedIds.goals).eq('user_id', userId)
                    .then(res => {
                        if (res.error) return supabase.from('goals').delete().in('id', localData.deletedIds.goals).eq('user_id', userId);
                    })
            );
        }
        if (localData.deletedIds?.habits?.length > 0) {
            deletePromises.push(
                supabase.from('habits').update({ deleted_at: nowIso, last_updated: nowTs }).in('id', localData.deletedIds.habits).eq('user_id', userId)
                    .then(res => {
                        if (res.error) return supabase.from('habits').delete().in('id', localData.deletedIds.habits).eq('user_id', userId);
                    })
            );
        }
        if (localData.deletedIds?.journalEntries?.length > 0) {
            deletePromises.push(
                supabase.from('journal_entries').update({ deleted_at: nowIso, last_updated: nowTs }).in('id', localData.deletedIds.journalEntries).eq('user_id', userId)
                    .then(res => {
                        if (res.error) return supabase.from('journal_entries').delete().in('id', localData.deletedIds.journalEntries).eq('user_id', userId);
                    })
            );
        }
        if (deletePromises.length > 0) await Promise.all(deletePromises);

        // 2. Fetch Latest Remote State
        const [
            { data: remoteGoals, error: gErr },
            { data: remoteHabits, error: hErr },
            { data: remoteEntries, error: jErr }
        ] = await Promise.all([
            supabase.from('goals').select('*').eq('user_id', userId),
            supabase.from('habits').select('*').eq('user_id', userId),
            supabase.from('journal_entries').select('*').eq('user_id', userId)
        ]);

        if (gErr || hErr || jErr) {
            const err = gErr || hErr || jErr;
            if (err?.message.includes("column") || err?.message.includes("cache")) {
                console.warn("[Sync] Cloud schema column mismatch warning. Falling back to base sync.");
            } else {
                throw new Error(`Cloud Read Failed: ${err?.message}`);
            }
        }

        // Collect IDs of items that are deleted remotely via deleted_at
        const remoteDeletedGoalIds = new Set<string>();
        const remoteDeletedHabitIds = new Set<string>();
        const remoteDeletedEntryIds = new Set<string>();

        (remoteGoals || []).forEach(item => { if (item.deleted_at) remoteDeletedGoalIds.add(item.id); });
        (remoteHabits || []).forEach(item => { if (item.deleted_at) remoteDeletedHabitIds.add(item.id); });
        (remoteEntries || []).forEach(item => { if (item.deleted_at) remoteDeletedEntryIds.add(item.id); });

        const sanitizeAndMap = <T extends { id: string }>(list: any[] | null): T[] => {
            return (list || [])
                .filter(item => !item.deleted_at) // Exclude soft-deleted rows
                .map(item => {
                    const mapped = mapFromDb(item);
                    const arrayFields = ['milestones', 'completedDates', 'daysOfWeek', 'activities', 'monthlyDays'];
                    arrayFields.forEach(field => {
                        if (mapped[field]) {
                            if (typeof mapped[field] === 'string') {
                                try { mapped[field] = JSON.parse(mapped[field]); } catch (e) { mapped[field] = []; }
                            }
                        } else {
                            mapped[field] = [];
                        }
                    });

                    // Safety: parse nested reward JSON if stored as string
                    if (mapped.reward && typeof mapped.reward === 'string') {
                        try { mapped.reward = JSON.parse(mapped.reward); } catch (e) { mapped.reward = undefined; }
                    }

                    // Safety: ensure createdAt exists
                    if (!mapped.createdAt && (item.created_at || item.createdAt)) {
                        mapped.createdAt = item.created_at || item.createdAt;
                    }
                    if (!mapped.createdAt) {
                        mapped.createdAt = new Date().toISOString();
                    }

                    return mapped as T;
                });
        };

        const rGoals = sanitizeAndMap<Goal>(remoteGoals);
        const rHabits = sanitizeAndMap<Habit>(remoteHabits);
        const rEntries = sanitizeAndMap<JournalEntry>(remoteEntries);

        // Sets of deleted IDs to avoid pushing or resurrecting deleted items (local + remote)
        const deletedGoalSet = new Set([...(localData.deletedIds?.goals || []), ...remoteDeletedGoalIds]);
        const deletedHabitSet = new Set([...(localData.deletedIds?.habits || []), ...remoteDeletedHabitIds]);
        const deletedEntrySet = new Set([...(localData.deletedIds?.journalEntries || []), ...remoteDeletedEntryIds]);

        // 3. Determine Push (Local to Cloud)
        const findNewer = <T extends { id: string; lastUpdated?: number }>(
            localList: T[], 
            remoteList: T[],
            deletedSet: Set<string>
        ) => {
            return localList
                .filter(local => !deletedSet.has(local.id))
                .filter(local => {
                    const remote = remoteList.find(r => r.id === local.id);
                    const localTS = Number(local.lastUpdated) || 0;
                    const remoteTS = remote ? (Number(remote.lastUpdated) || 0) : -1;
                    return localTS > remoteTS;
                });
        };

        const goalsPush = findNewer(localData.goals, rGoals, deletedGoalSet);
        const habitsPush = findNewer(localData.habits, rHabits, deletedHabitSet);
        const entriesPush = findNewer(localData.journalEntries, rEntries, deletedEntrySet);

        // Safe upsert helper: gracefully falls back if optional columns are missing on the remote table
        const safeUpsert = async (table: string, rows: any[]) => {
            if (rows.length === 0) return;
            const res = await supabase.from(table).upsert(rows);
            if (res.error) {
                const msg = res.error.message || '';
                if (msg.includes('column') || res.error.code === '42703' || res.error.code === 'PGRST204') {
                    console.warn(`[Sync] Table "${table}" has missing columns in Supabase. Applying schema fallback. (Run supabase-schema.sql to upgrade).`);
                    const fallbackRows = rows.map(r => {
                        const copy = { ...r };
                        if (table === 'habits') {
                            delete copy.reward;
                            delete copy.target_amount;
                            delete copy.target_unit;
                            delete copy.schedule_type;
                            delete copy.monthly_days;
                        }
                        if (table === 'journal_entries') {
                            delete copy.title;
                            delete copy.category;
                        }
                        delete copy.deleted_at;
                        return copy;
                    });
                    const fallbackRes = await supabase.from(table).upsert(fallbackRows);
                    if (fallbackRes.error) throw fallbackRes.error;
                    return;
                }
                throw res.error;
            }
        };

        const pushPromises: Promise<any>[] = [];
        if (goalsPush.length > 0) pushPromises.push(safeUpsert('goals', goalsPush.map(g => ({ ...mapGoalToDb(g), user_id: userId }))));
        if (habitsPush.length > 0) pushPromises.push(safeUpsert('habits', habitsPush.map(h => ({ ...mapHabitToDb(h), user_id: userId }))));
        if (entriesPush.length > 0) pushPromises.push(safeUpsert('journal_entries', entriesPush.map(e => ({ ...mapEntryToDb(e), user_id: userId }))));

        if (pushPromises.length > 0) {
            await Promise.all(pushPromises);
        }

        // 4. Final Merge Logic (ignoring deleted items)
        const merge = <T extends { id: string; lastUpdated?: number }>(
            localList: T[], 
            remoteList: T[],
            deletedSet: Set<string>
        ): T[] => {
            const map = new Map<string, T>();
            [...remoteList, ...localList].forEach(item => {
                if (deletedSet.has(item.id)) return;
                const existing = map.get(item.id);
                if (!existing || (Number(item.lastUpdated) || 0) >= (Number(existing.lastUpdated) || 0)) {
                    map.set(item.id, item);
                }
            });
            return Array.from(map.values());
        };

        return {
            success: true,
            message: "Growth Vault Synchronized",
            data: {
                goals: merge(localData.goals, rGoals, deletedGoalSet),
                habits: merge(localData.habits, rHabits, deletedHabitSet),
                journalEntries: merge(localData.journalEntries, rEntries, deletedEntrySet),
                deletedIds: {
                    goals: Array.from(deletedGoalSet),
                    habits: Array.from(deletedHabitSet),
                    journalEntries: Array.from(deletedEntrySet)
                },
                syncStatus: { lastSync: Date.now(), status: 'synced' }
            }
        };
    } catch (e: any) {
        console.error("Lumina Sync Error:", e);
        return { success: false, message: e.message || "Sync Failed" };
    }
};

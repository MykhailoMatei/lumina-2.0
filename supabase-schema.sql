-- Lumina: Supabase Master Clean Slate & Migration Script
-- Run this script in the Supabase SQL Editor (SQL Editor -> New Query -> Run)

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Goals Table
create table if not exists public.goals (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    why_statement text,
    category text not null default 'Personal',
    progress numeric not null default 0,
    deadline text,
    completed boolean not null default false,
    milestones jsonb not null default '[]'::jsonb,
    is_paused boolean not null default false,
    outcome_label text,
    identity_impact text,
    what_stayed text,
    what_shifted text,
    archived_at timestamptz,
    start_date text,
    deleted_at timestamptz default null,
    last_updated bigint not null default 0
);

-- Migrations for existing goals tables
alter table public.goals add column if not exists deleted_at timestamptz default null;
alter table public.goals add column if not exists last_updated bigint not null default 0;

-- 3. Habits Table
create table if not exists public.habits (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    category text not null default 'Personal',
    trigger text,
    description text,
    duration text default '5m',
    time_of_day text not null default 'Morning',
    days_of_week jsonb not null default '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
    schedule_type text not null default 'weekly',
    monthly_days jsonb not null default '[]'::jsonb,
    reminder_time text,
    linked_goal_id text,
    streak numeric not null default 0,
    completed_dates jsonb not null default '[]'::jsonb,
    target_amount numeric,
    target_unit text,
    reward jsonb default null,
    created_at timestamptz not null default now(),
    deleted_at timestamptz default null,
    last_updated bigint not null default 0
);

-- Migrations for existing habits tables
alter table public.habits add column if not exists target_amount numeric;
alter table public.habits add column if not exists target_unit text;
alter table public.habits add column if not exists reward jsonb default null;
alter table public.habits add column if not exists created_at timestamptz not null default now();
alter table public.habits add column if not exists deleted_at timestamptz default null;
alter table public.habits add column if not exists last_updated bigint not null default 0;
alter table public.habits add column if not exists schedule_type text not null default 'weekly';
alter table public.habits add column if not exists monthly_days jsonb not null default '[]'::jsonb;

-- 4. Journal Entries Table
create table if not exists public.journal_entries (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text,
    category text not null default 'Daily',
    date text not null,
    content text,
    prompt text,
    mood text not null default 'Good',
    activities jsonb not null default '[]'::jsonb,
    ai_insight text,
    linked_goal_id text,
    linked_habit_id text,
    image_data text,
    deleted_at timestamptz default null,
    last_updated bigint not null default 0
);

-- Migrations for existing journal_entries tables
alter table public.journal_entries add column if not exists title text;
alter table public.journal_entries add column if not exists category text not null default 'Daily';
alter table public.journal_entries add column if not exists deleted_at timestamptz default null;
alter table public.journal_entries add column if not exists last_updated bigint not null default 0;

-- 5. Push Subscriptions Table
create table if not exists public.user_push_subscriptions (
    user_id uuid references auth.users(id) on delete cascade primary key,
    subscription jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Migration for existing user_push_subscriptions
alter table public.user_push_subscriptions add column if not exists updated_at timestamptz default now();

-- 6. Enable Row Level Security (RLS)
alter table public.goals enable row level security;
alter table public.habits enable row level security;
alter table public.journal_entries enable row level security;
alter table public.user_push_subscriptions enable row level security;

-- 7. RLS Policies
-- Goals policies
drop policy if exists "Users own their goals" on public.goals;
create policy "Users own their goals" on public.goals
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Habits policies
drop policy if exists "Users own their habits" on public.habits;
create policy "Users own their habits" on public.habits
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Journal policies
drop policy if exists "Users own their journal entries" on public.journal_entries;
create policy "Users own their journal entries" on public.journal_entries
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Push subscriptions policies
drop policy if exists "Users own their push subscriptions" on public.user_push_subscriptions;
create policy "Users own their push subscriptions" on public.user_push_subscriptions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. Storage Buckets for Avatars and Journal Images
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public) 
values ('journal', 'journal', true)
on conflict (id) do update set public = true;

-- Storage policies: authenticated users can access and manage their own folders
drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars" on storage.objects
    for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars" on storage.objects
    for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars" on storage.objects
    for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatars are publicly viewable" on storage.objects;
create policy "Avatars are publicly viewable" on storage.objects
    for select using (bucket_id = 'avatars');

drop policy if exists "Users can manage their own journal photos" on storage.objects;
create policy "Users can manage their own journal photos" on storage.objects
    for all using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Journal photos are publicly viewable" on storage.objects;
create policy "Journal photos are publicly viewable" on storage.objects
    for select using (bucket_id = 'journal');

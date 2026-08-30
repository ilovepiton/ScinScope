-- SkinScope referral trial support.
-- Run this in Supabase SQL editor after auth is connected.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  referrer_code text,
  status text not null default 'inviter_trial',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists referrals_one_invite_per_user
  on public.referrals(user_id)
  where status = 'inviter_trial';

create index if not exists referrals_referrer_code_idx
  on public.referrals(referrer_code);

alter table public.referrals enable row level security;

create policy "Users can read their own referrals"
  on public.referrals
  for select
  using (auth.uid() = user_id);

create policy "Users can create their own referral trial"
  on public.referrals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own referral trial"
  on public.referrals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

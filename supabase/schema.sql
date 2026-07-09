-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- Uses the same Supabase project as the Storyboard app, just a new table + bucket.

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null default 'อื่นๆ',
  description text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

alter table meals enable row level security;

drop policy if exists "read own meals" on meals;
create policy "read own meals" on meals
  for select using (owner = auth.uid());

drop policy if exists "insert own meals" on meals;
create policy "insert own meals" on meals
  for insert with check (owner = auth.uid());

drop policy if exists "update own meals" on meals;
create policy "update own meals" on meals
  for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "delete own meals" on meals;
create policy "delete own meals" on meals
  for delete using (owner = auth.uid());

-- Storage bucket for meal photos
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "read meal images" on storage.objects;
create policy "read meal images" on storage.objects
  for select using (bucket_id = 'meal-images');

drop policy if exists "upload own meal images" on storage.objects;
create policy "upload own meal images" on storage.objects
  for insert with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own meal images" on storage.objects;
create policy "delete own meal images" on storage.objects
  for delete using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

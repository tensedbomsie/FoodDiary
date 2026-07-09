-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)

alter table meals add column if not exists fullness smallint;
alter table meals add column if not exists hunger smallint;
alter table meals add column if not exists tags text[] not null default '{}';

alter table meals drop constraint if exists meals_fullness_check;
alter table meals add constraint meals_fullness_check check (fullness is null or (fullness between 1 and 5));

alter table meals drop constraint if exists meals_hunger_check;
alter table meals add constraint meals_hunger_check check (hunger is null or (hunger between 1 and 5));

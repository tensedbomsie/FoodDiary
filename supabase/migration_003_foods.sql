-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  kcal numeric,
  protein text,
  created_at timestamptz not null default now()
);

alter table foods enable row level security;

drop policy if exists "own foods" on foods;
create policy "own foods" on foods
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create table if not exists meal_foods (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  food_id uuid not null references foods(id) on delete cascade,
  quantity numeric not null default 1,
  kcal_override numeric,
  created_at timestamptz not null default now()
);

alter table meal_foods enable row level security;

drop policy if exists "own meal_foods" on meal_foods;
create policy "own meal_foods" on meal_foods
  for all using (
    exists (select 1 from meals m where m.id = meal_foods.meal_id and m.owner = auth.uid())
  ) with check (
    exists (select 1 from meals m where m.id = meal_foods.meal_id and m.owner = auth.uid())
  );

-- Seed a starter food library (only if you have no foods yet)
insert into foods (owner, name, category, kcal, protein)
select u.id, v.name, v.category, v.kcal, v.protein
from (select id from auth.users order by created_at asc limit 1) u
cross join (values
  ('นมโปรตีน', 'นม', 230, '31g'),
  ('นมโปรตีนถุง', 'นม', 320, '~30g'),
  ('นมไทยเดนมาร์ก', 'นม', 170, '~8g'),
  ('นมเปรี้ยว', 'นม', 130, '~3g'),
  ('นมสด', 'นม', 180, '~8g'),
  ('นมสดคาราเมลไข่มุก', 'นม', 320, '~8g'),

  ('กล้วยน้ำว้า 1 ลูก', 'ผลไม้', 70, null),
  ('แอปเปิ้ล 100g', 'ผลไม้', 50, null),
  ('แอปเปิ้ล 200g', 'ผลไม้', 100, null),

  ('หมูปิ้ง 1 ไม้', 'อาหารบ้าน', 50, null),
  ('หมูปิ้ง 6 ไม้', 'อาหารบ้าน', 300, null),
  ('หมูปิ้ง 8 ไม้', 'อาหารบ้าน', 400, null),
  ('ข้าวเหนียว 1 ห่อ', 'อาหารบ้าน', 160, null),
  ('คอหมูย่าง 100g', 'อาหารบ้าน', 300, null),
  ('เนื้อทอด 100g', 'อาหารบ้าน', 250, null),
  ('ต้มแซ่บหมู', 'อาหารบ้าน', 180, null),
  ('ต้มแซ่บเนื้อ', 'อาหารบ้าน', 350, null),
  ('หูหมู', 'อาหารบ้าน', 180, null),
  ('ไก่ต้ม', 'อาหารบ้าน', null, null),
  ('อกไก่', 'อาหารบ้าน', null, null),

  ('Chicken Roll KFC', 'Fast Food', 260, null),
  ('เฟรนช์ฟรายส์เล็ก', 'Fast Food', 220, null),
  ('โดนัทกุ้ง', 'Fast Food', 170, null),
  ('ไก่ไม่มีกระดูก 2 ชิ้น', 'Fast Food', 180, null),
  ('KFC All Boneless Set', 'Fast Food', 700, null),

  ('กะเพราหมูกรอบไข่ดาว', 'อาหารจานเดียว', 700, null),
  ('กะเพราเนื้อไข่ดาว', 'อาหารจานเดียว', 700, null),
  ('มาม่า (เทน้ำ)', 'อาหารจานเดียว', 270, null),
  ('ข้าว 150g', 'อาหารจานเดียว', 250, null),

  ('เต้าหู้ทอด', 'ของกินเล่น', 350, null),
  ('เต้าหู้ทอด+เต้าหู้ข้าวโพด', 'ของกินเล่น', 450, null),
  ('มาชิตะ', 'ของกินเล่น', 60, null),
  ('ขนม 50 kcal', 'ของกินเล่น', 50, null),
  ('ไส้กรอกแดง', 'ของกินเล่น', 180, null),
  ('Krispy Kreme Original', 'ของกินเล่น', 220, null),

  ('โออิชิองุ่น', 'เครื่องดื่ม', 60, null),
  ('น้ำอ้อย', 'เครื่องดื่ม', 180, null),
  ('น้ำลำไย', 'เครื่องดื่ม', 200, null),
  ('Apple Cider Drink', 'เครื่องดื่ม', 50, null),

  ('อกไก่ 100g', 'วัตถุดิบ', 165, null),
  ('เนื้อวัว 100g', 'วัตถุดิบ', 200, null),
  ('คอหมู 100g', 'วัตถุดิบ', 300, null),
  ('ไข่ต้ม', 'วัตถุดิบ', 70, null),
  ('ไข่ดาว', 'วัตถุดิบ', 160, null)
) as v(name, category, kcal, protein)
where not exists (select 1 from foods);

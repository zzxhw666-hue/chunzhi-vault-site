create extension if not exists pgcrypto;

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 120),
  category text not null check (char_length(category) <= 40),
  content text not null check (char_length(content) <= 8000),
  tags text[] not null default '{}',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vault_items enable row level security;

drop policy if exists "Public can read vault items" on public.vault_items;
create policy "Public can read vault items"
on public.vault_items
for select
to anon
using (true);

drop policy if exists "Public can create vault items" on public.vault_items;
create policy "Public can create vault items"
on public.vault_items
for insert
to anon
with check (true);

drop policy if exists "Public can update vault items" on public.vault_items;
create policy "Public can update vault items"
on public.vault_items
for update
to anon
using (true)
with check (true);

drop policy if exists "Public can delete vault items" on public.vault_items;
create policy "Public can delete vault items"
on public.vault_items
for delete
to anon
using (true);

create index if not exists vault_items_updated_at_idx on public.vault_items (updated_at desc);
create index if not exists vault_items_category_idx on public.vault_items (category);

do $$
begin
  if to_regclass('public.items') is not null then
    insert into public.vault_items (title, category, content, tags, source_url, created_at, updated_at)
    select
      title,
      category,
      content,
      coalesce(tags, '{}'),
      source_url,
      coalesce(created_at, now()),
      coalesce(updated_at, now())
    from public.items
    where not exists (
      select 1
      from public.vault_items
      where vault_items.title = items.title
        and vault_items.content = items.content
    );
  end if;

  if not exists (select 1 from public.vault_items) then
    insert into public.vault_items (title, category, content, tags, source_url)
    values (
      '第一条资料',
      '示例',
      '这里可以保存你的资料、链接、选题、客户信息或灵感笔记。上线后输入 chunzhi 即可进入这个资料库。',
      array['入门', '示例'],
      null
    );
  end if;
end $$;

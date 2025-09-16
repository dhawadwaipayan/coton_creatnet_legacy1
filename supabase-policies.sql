-- Supabase RLS and storage policies
-- Apply in Supabase SQL editor. Adjust table/column names if they differ.
-- Safe to run multiple times; create/alter statements are idempotent where possible.

-- 1) Enable RLS on core tables
alter table if exists boards enable row level security;
alter table if exists user_approvals enable row level security;
alter table if exists approved_users enable row level security;
alter table if exists admin_users enable row level security;
alter table if exists user_groups enable row level security;
alter table if exists group_memberships enable row level security;
alter table if exists generation_usage enable row level security;
alter table if exists storage.objects enable row level security;

-- 2) Helper view for approved users
create or replace view approved_user_ids as
select user_id from approved_users where is_active = true;

-- 3) Boards policies: only owner, and only if approved
-- Drop or rename conflicting policies first if needed in the UI.
create policy boards_select_own
on boards for select to authenticated
using (
  user_id = auth.uid()
  and auth.uid() in (select user_id from approved_user_ids)
);

create policy boards_modify_own
on boards for all to authenticated
using (
  user_id = auth.uid()
  and auth.uid() in (select user_id from approved_user_ids)
)
with check (
  user_id = auth.uid()
);

-- Optional: trigger to set user_id := auth.uid() on insert if null
create or replace function set_user_id()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists boards_set_user_id on boards;
create trigger boards_set_user_id
before insert on boards
for each row execute procedure set_user_id();

-- 4) Approval tables: users can see only their own approval request; admins full via service role
create policy user_approvals_owner_read
on user_approvals for select to authenticated
using (email = auth.email());

create policy user_approvals_owner_insert
on user_approvals for insert to authenticated
with check (email = auth.email());

-- Admin tables (admin_users): block by default; manage via service role only
-- Intentionally no public policies on admin_users

-- 5) Groups and memberships: only admins can manage; members can read minimal data
-- Admins identified by presence in admin_users
create or replace function is_admin(uid uuid)
returns boolean language sql immutable as $$
  select exists (select 1 from admin_users a where a.user_id = uid)
$$;

-- user_groups read: admin only
create policy user_groups_admin_read
on user_groups for select to authenticated
using (is_admin(auth.uid()));

create policy user_groups_admin_write
on user_groups for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

-- group_memberships read: admin can read all; member can read own membership
create policy group_memberships_admin_read
on group_memberships for select to authenticated
using (is_admin(auth.uid()));

create policy group_memberships_member_read
on group_memberships for select to authenticated
using (user_id = auth.uid());

create policy group_memberships_admin_write
on group_memberships for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

-- 6) Generation usage: admin read all; user read/write own
create policy generation_usage_admin_read
on generation_usage for select to authenticated
using (is_admin(auth.uid()));

create policy generation_usage_user_read
on generation_usage for select to authenticated
using (user_id = auth.uid());

create policy generation_usage_user_write
on generation_usage for insert to authenticated
with check (user_id = auth.uid());

-- 7) Storage policies: make buckets private and scope by path prefix user_id/
-- Adjust bucket IDs as needed: 'board-images', 'board-videos'
-- Example policy expects object name like: userId/boardId/filename.ext
create policy storage_read_own_images
on storage.objects for select to authenticated
using (
  bucket_id = 'board-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy storage_write_own_images
on storage.objects for insert to authenticated
with check (
  bucket_id = 'board-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy storage_read_own_videos
on storage.objects for select to authenticated
using (
  bucket_id = 'board-videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy storage_write_own_videos
on storage.objects for insert to authenticated
with check (
  bucket_id = 'board-videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- 8) Optional: forbid deletes except owner or admin
create policy storage_delete_own
on storage.objects for delete to authenticated
using (
  (bucket_id in ('board-images','board-videos') and split_part(name, '/', 1) = auth.uid()::text)
  or is_admin(auth.uid())
);

-- 9) Basic safety: ensure only approved users can select from key tables
create policy boards_select_approved_only
on boards for select to authenticated
using (auth.uid() in (select user_id from approved_user_ids));

-- Note: Supabase policies are permissive by default. Review and remove any broad existing policies.
-- After applying, test with: unapproved user cannot read/modify boards or storage; approved user can.

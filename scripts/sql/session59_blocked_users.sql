-- v337 (Session 59): block a user (App Store 1.2). APPLIED 2026-10-16 as migration session59_blocked_users.
create table if not exists public.blocked_users (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_id);
alter table public.blocked_users enable row level security;
revoke all on public.blocked_users from anon, authenticated;

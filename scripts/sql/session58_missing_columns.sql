-- Session 58 (Ravi OK: "database ka access hai … sab bna dena"). APPLIED on the live DB as migrations
-- session58_missing_columns and session58_safe_defaults_private_buckets.
alter table public.campaigns
  add column if not exists gender text, add column if not exists follower_min integer, add column if not exists follower_max integer,
  add column if not exists locations text[], add column if not exists max_creators integer, add column if not exists collab_mode text,
  add column if not exists dos text, add column if not exists donts text, add column if not exists hashtags text[];
alter table public.creator_profiles add column if not exists youtube_avg_views integer;
alter table public.users add column if not exists suspended_until timestamptz;
alter table public.transactions add column if not exists razorpay_payment_id text;
alter table public.transactions alter column payout_status set default 'PENDING';
update storage.buckets set public = false where id in ('content-submissions', 'live-proofs', 'ugc-assets');

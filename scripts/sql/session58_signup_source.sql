-- Session 58 (Ravi OK: "han kro") — where a signup came from. All nullable, nothing reads them except
-- Admin → Overview → Growth ideas → "Where signups come from". Written once per user (first touch).
alter table public.users add column if not exists signup_source text;
alter table public.users add column if not exists utm_source   text;
alter table public.users add column if not exists utm_medium   text;
alter table public.users add column if not exists utm_campaign text;
comment on column public.users.signup_source is 'Session 58: channel a signup came from (instagram, google, meta_ads, direct, android_app, …). Set once.';

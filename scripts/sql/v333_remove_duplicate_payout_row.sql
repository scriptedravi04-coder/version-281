-- v333 — remove the duplicate payout row on the Dell mouse deal (left over from the v310 double-payout bug).
-- (fixed: the live table has payout_reference, not utr_number)
-- WAITS FOR RAVI'S OK. Run once in the Supabase SQL editor. Safe to run twice (the second run deletes nothing).
--   keep:   e7d720e7…  (PAID, ₹13,000 gross / ₹11,700 net, UTR 3245465787908)
--   delete: f3d6d152…  (empty copy — the receipt showed ₹0.00 and Earnings listed the deal twice because of it)
begin;

-- 1) Look first: must show exactly 2 rows for the same deal.
select id, deal_id, gross_amount, creator_net_amount, payout_status, payout_reference, created_at
from transactions
where id::text like 'f3d6d152%' or id::text like 'e7d720e7%';

-- 2) Delete only the empty copy, and only if the paid row for the same deal is really there.
delete from transactions d
where d.id::text like 'f3d6d152%'
  and coalesce(d.payout_reference, '') = ''
  and exists (
    select 1 from transactions k
    where k.id::text like 'e7d720e7%'
      and k.deal_id = d.deal_id
      and coalesce(k.payout_reference, '') <> ''
  );

commit;

// Session 58: the follower range a brand picked (Nano … Celebrities) as numbers, saved on the campaign.
// The old payload always sent 10k–500k (or 4k / 1M) whatever was picked.
const TIERS = { Nano: [4000, 10000], Micro: [10000, 50000], Macro: [50000, 500000], Mega: [500000, 1000000], Celeb: [1000000, null], Celebrities: [1000000, null] };
export function followerRangeFor(selected) {
  const picked = (Array.isArray(selected) ? selected : []).map((k) => TIERS[k]).filter(Boolean);
  if (!picked.length) return { follower_min: null, follower_max: null };
  const min = Math.min(...picked.map((t) => t[0]));
  const max = picked.some((t) => t[1] == null) ? null : Math.max(...picked.map((t) => t[1]));
  return { follower_min: min, follower_max: max };
}

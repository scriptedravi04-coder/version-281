// Session 58 (Ravi, Q11): the admin "Fees & Risk" controls are now enforced on the server, not just shown.
// Reads the live platform_fee_config row. If it can't be read we don't block anyone (fail open):
// a database hiccup must never stop normal payouts or campaign creation.
export type RiskControls = { payoutFreezeAll: boolean; minWithdrawal: number; minBudget: number | null; maxBudget: number | null };

const num = (v: any): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function riskControlsFromRow(row: any): RiskControls {
  const minW = num(row?.withdrawal_min_limit ?? row?.min_withdrawal_amount);
  const minB = num(row?.min_campaign_budget);
  const maxB = num(row?.max_campaign_budget);
  return {
    payoutFreezeAll: row?.payout_freeze_all === true,
    minWithdrawal: minW && minW > 0 ? minW : 0,
    minBudget: minB && minB > 0 ? minB : null,
    maxBudget: maxB && maxB > 0 ? maxB : null,
  };
}

export async function readRiskControls(client: any): Promise<RiskControls> {
  try {
    if (!client) return riskControlsFromRow(null);
    const { data } = await client.from("platform_fee_config").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return riskControlsFromRow(data);
  } catch {
    return riskControlsFromRow(null);
  }
}

/** Pure: an error message if the campaign budget is outside the admin limits, else null. Barter (0 budget) is never blocked. */
export function campaignBudgetProblem(budgetMin: number, budgetMax: number, rc: RiskControls): string | null {
  const lo = Number(budgetMin) || 0, hi = Number(budgetMax) || lo;
  if (lo <= 0 && hi <= 0) return null;
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  if (rc.minBudget && hi < rc.minBudget) return `Campaign budget must be at least ${inr(rc.minBudget)}.`;
  if (rc.maxBudget && hi > rc.maxBudget) return `Campaign budget can't be more than ${inr(rc.maxBudget)}. Contact support for bigger campaigns.`;
  return null;
}

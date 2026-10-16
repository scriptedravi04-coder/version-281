import { describe, it, expect } from "vitest";
import { creatorProfileStrength } from "./lib/creatorTasks";
import { visibleCreators } from "./lib/visibleCreators";

describe("v286 · profile checklist reads what onboarding saved", () => {
  it("onboarding fields count as done", () => {
    const r = creatorProfileStrength({ photo: "x", bio: "hi", primary_niche: "Food", ig_followers: 5000, story_rate: 500, portfolio: [{}] });
    expect(r.missing).toEqual([]);
    expect(r.percent).toBe(100);
  });
  it("really empty parts are still pending", () => {
    expect(creatorProfileStrength({ photo: "x" }).missing).toContain("Rate card");
  });
  it("only approved creators are visible", () => {
    const list = [{ full_name: "Asha", profile_status: "approved" }, { full_name: "Ankit Tomar", profile_status: "pending" }, { full_name: "Developer Bypass" }];
    expect(visibleCreators(list).map((c) => c.full_name)).toEqual(["Asha"]);
  });
});

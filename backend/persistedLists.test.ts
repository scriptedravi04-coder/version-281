import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { reviewRow, mergeReviews, toggleSavedCreator, isCreatorSaved, fetchCreatorReviewsFromTable } from "./persistedLists";

describe("v302 · saved creators + brand reviews live in their tables", () => {
  it("a review keeps the brand's stars (trigger averages the three parts)", () => {
    const r = reviewRow({ creator_id: "c1", brand_id: "b1", rating: 4, comment: "Great work" });
    expect([r.communication_rating, r.timeliness_rating, r.quality_rating]).toEqual([4, 4, 4]);
    expect(r.review_text).toBe("Great work");
    expect(reviewRow({ creator_id: "c", brand_id: "b", rating: 9 }).quality_rating).toBe(5);
  });
  it("table + memory reviews merge without duplicates, newest first", () => {
    const t = [{ brand_id: "b1", comment: "Nice", rating: 5, created_at: "2026-10-02" }];
    const local = [{ brand_id: "b1", comment: "Nice", rating: 5, created_at: "2026-10-02" }, { brand_id: "b2", comment: "Ok", rating: 3, created_at: "2026-10-03" }];
    const m = mergeReviews(t, local);
    expect(m.length).toBe(2);
    expect(m[0].brand_id).toBe("b2");
    expect(mergeReviews(null, local)).toEqual(local);
  });
  it("no database → null, and the route keeps the old in-memory list", async () => {
    expect(await toggleSavedCreator(null, "b", "c")).toBe(null);
    expect(await isCreatorSaved(null, "b", ["c"])).toBe(null);
    expect(await fetchCreatorReviewsFromTable(null, "c")).toBe(null);
  });
  it("routes use the tables; whole-app blob upload is off unless YBEX_SYNC_BLOB=true", () => {
    const cr = readFileSync("backend/creators_routes.ts", "utf8");
    expect(cr).toContain("await toggleSavedCreator(privilegedSupabase, brand_id, creator_id)");
    expect(cr).toContain("await insertCreatorReview(privilegedSupabase, reviewObj)");
    const s = readFileSync("backend/server.ts", "utf8");
    expect(s).toContain('process.env.YBEX_SYNC_BLOB === "true"');
    expect(s).toContain('privilegedSupabase.from("team_activity_logs").insert(row)');
    expect(readFileSync("src/lib/razorpay.js", "utf8")).not.toContain('hostname.includes("run.app")');
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { cleanFilters, matchSaved, freshFor, alertText, cleanHistoryRows, slimCard, brandKey, createAssistStore } from "./assist_store";
import { CLEAR_CHAT } from "../src/components/assist/brand/brandLogic";

const creator = (id: string, extra: any = {}) => ({ user_id: id, name: `Creator ${id}`, profile_status: "approved", category: "Fashion", city: "Jaipur", followers_instagram: 20000, ...extra });

describe("v302 · Ybex Assist database pieces", () => {
  it("brand key: team members use the parent brand", () => {
    expect(brandKey({ user_id: "u1", parent_brand_id: "b1" })).toBe("b1");
    expect(brandKey({ user_id: "u1" })).toBe("u1");
  });

  it("saved filters are cleaned (numbers, short strings, known gender only)", () => {
    const f = cleanFilters({ city: "Jaipur", niches: ["Fashion"], followersMin: "10000", maxRate: -5, gender: "x", language: "HINDI" });
    expect(f.followersMin).toBe(10000);
    expect(f.maxRate).toBe(0);
    expect(f.gender).toBe("");
    expect(f.language).toBe("hindi");
  });

  it("matches only approved, real creators in the city / niche / follower range", () => {
    const rows = [
      creator("a"),
      creator("b", { city: "Delhi" }),
      creator("c", { profile_status: "pending" }),
      creator("d", { name: "test account" }),
      creator("e", { followers_instagram: 500000 }),
      creator("f", { category: "Food" }),
    ];
    const ids = matchSaved(rows, { city: "Jaipur", niches: ["Fashion"], followersMin: 10000, followersMax: 100000 }).map((c: any) => c.user_id);
    expect(ids).toEqual(["a"]);
  });

  it("first check only remembers; later checks find the new creators", () => {
    const s = { filters: { city: "Jaipur" }, seen_ids: [], last_checked_at: null };
    const first = freshFor(s, [creator("a")]);
    expect(first.fresh).toEqual([]);
    expect(first.seenNext).toEqual(["a"]);
    const later = freshFor({ ...s, seen_ids: first.seenNext, last_checked_at: "2026-10-14T00:00:00Z" }, [creator("a"), creator("b")]);
    expect(later.fresh).toEqual(["b"]);
  });

  it("alert text names up to 3 creators", () => {
    const t = alertText("Fashion · Jaipur", [creator("a"), creator("b"), creator("c"), creator("d")]);
    expect(t.title).toBe("4 new creators for your search");
    expect(t.message).toContain("+1");
  });

  it("history keeps only text + the card's type", () => {
    const rows = cleanHistoryRows({ messages: [{ user: true, text: "hi" }, { user: false, text: "x", card: { type: "creators", items: [{ phone: "999" }] } }, { user: true, text: "" }] }, "b1", "u1");
    expect(rows.length).toBe(2);
    expect(rows[1].card).toEqual({ type: "creators" });
    expect(JSON.stringify(rows)).not.toContain("999");
    expect(slimCard(null)).toBe(null);
  });

  it("no database → every call answers null / false (the old behaviour takes over)", async () => {
    const s = createAssistStore(() => null);
    expect(s.hasDb()).toBe(false);
    expect(await s.takeUsage("b", 30)).toBe(null);
    expect(await s.history("b")).toBe(null);
    expect(await s.listSaved("b")).toBe(null);
  });

  it("'chat clear karo' clears; normal sentences don't", () => {
    expect(CLEAR_CHAT.test("chat clear karo")).toBe(true);
    // Session 58 (requirement change): "nayi chat" now opens a fresh chat (NEW_CHAT) and no longer deletes the old one.
    expect(CLEAR_CHAT.test("nayi chat")).toBe(false);
    expect(CLEAR_CHAT.test("clear chat")).toBe(true);
    expect(CLEAR_CHAT.test("chat mein creators dikhao")).toBe(false);
  });

  it("tables are server-only and the routes are for brands", () => {
    const sql = readFileSync("scripts/sql/session52_assist.sql", "utf8");
    for (const t of ["assist_messages", "assist_usage", "assist_saved_searches"]) expect(sql).toContain(`alter table public.${t} enable row level security`);
    expect(sql).toContain("revoke all on function public.assist_usage_take");
    const r = readFileSync("backend/assist_routes.ts", "utf8");
    expect(r).toContain("setupAssistDataRoutes");
    expect(r).toContain('if (user.role !== "brand" && user.role !== "creator") { res.status(403)'); // v304: creators use Eva too
    expect(readFileSync("backend/server.ts", "utf8")).toContain("setupAssistDataRoutes(router, { parseAuthUser, privilegedSupabase })");
  });
});

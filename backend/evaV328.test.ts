import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createAssistStore } from "./assist_store";

// v328: a tiny in-memory stand-in for the Supabase client — just the calls assist_store makes.
function fakeDb(tables: Record<string, any[]>, rpcImpl?: (name: string, args: any) => any) {
  const log: any[] = [];
  const from = (name: string) => {
    const t = (tables[name] = tables[name] || []);
    let op: "select" | "update" | "delete" = "select";
    let patch: any = null;
    const filters: ((r: any) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    let lim: number | null = null, rng: [number, number] | null = null, single = false;
    const run = () => {
      let rows = t.filter((r) => filters.every((f) => f(r)));
      if (op === "delete") { for (const r of rows) t.splice(t.indexOf(r), 1); return { data: null, error: null }; }
      if (op === "update") { for (const r of rows) Object.assign(r, patch); }
      if (order) { const { col, asc } = order; rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1)); }
      if (rng) rows = rows.slice(rng[0], rng[1] + 1);
      if (lim != null) rows = rows.slice(0, lim);
      const data = rows.map((r) => ({ ...r }));
      return { data: single ? data[0] || null : data, error: null };
    };
    const q: any = {
      select: () => q,
      update: (p: any) => { op = "update"; patch = p; return q; },
      delete: () => { op = "delete"; return q; },
      insert: (row: any) => { t.push(...(Array.isArray(row) ? row : [row])); return Promise.resolve({ error: null }); },
      upsert: (row: any) => { const i = t.findIndex((r) => r.brand_id === row.brand_id && r.label === row.label); if (i >= 0) Object.assign(t[i], row); else t.push({ id: `s${t.length + 100}`, ...row }); return q; },
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return q; },
      is: (k: string, _v: any) => { filters.push((r) => r[k] == null); return q; },
      order: (col: string, o: any) => { order = { col, asc: o?.ascending !== false }; log.push({ name, order: col }); return q; },
      range: (a: number, b: number) => { rng = [a, b]; log.push({ name, range: [a, b] }); return q; },
      limit: (n: number) => { lim = n; return q; },
      maybeSingle: () => { single = true; return q; },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  return { client: { from, rpc: async (n: string, a: any) => (rpcImpl ? rpcImpl(n, a) : { data: null, error: { message: "no" } }) }, log, tables };
}

describe("v328 · Eva server fixes", () => {
  it("takeUsageCount returns the DB count (for 'messages left')", async () => {
    const { client } = fakeDb({}, () => ({ data: [{ allowed: true, used: 12 }], error: null }));
    const s = createAssistStore(() => client);
    expect(await s.takeUsageCount("b1", 30)).toEqual({ allowed: true, used: 12 });
    expect(await s.takeUsage("b1", 30)).toBe(true);
    expect(await createAssistStore(() => null).takeUsageCount("b1", 30)).toBe(null);
  });

  it("giveBackUsage takes one message back from today's row", async () => {
    const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const { client, tables } = fakeDb({ assist_usage: [{ brand_id: "b1", day, count: 5 }] });
    const s = createAssistStore(() => client);
    expect(await s.giveBackUsage("b1")).toBe(true);
    expect(tables.assist_usage[0].count).toBe(4);
    expect(await s.giveBackUsage("nobody")).toBe(false);
  });

  it("chat list uses the NEWEST messages", async () => {
    const msgs = [
      { brand_id: "b1", chat_id: "old", role: "user", text: "old q", created_at: "2026-01-01T00:00:00Z" },
      { brand_id: "b1", chat_id: "new", role: "user", text: "new q", created_at: "2026-10-01T00:00:00Z" },
    ];
    const { client } = fakeDb({ assist_messages: msgs });
    const chats = await createAssistStore(() => client).listChats("b1");
    expect(chats![0].chat_id).toBe("new");
    expect(chats![0].title).toBe("new q");
  });

  it("only one mute row and one work-alert row per brand", async () => {
    const { client, tables } = fakeDb({ assist_saved_searches: [
      { id: "m1", brand_id: "b1", label: "mute_a", filters: { kind: "mute" }, created_at: "1" },
      { id: "c1", brand_id: "b1", label: "work_a", filters: { kind: "campaigns" }, created_at: "2" },
    ], campaigns: [], ugc_briefs: [] });
    const s = createAssistStore(() => client);
    expect((await s.saveSearch("b1", "u1", "mute_b", { kind: "mute" }, [])).ok).toBe(true);
    expect((await s.saveSearch("b1", "u1", "work_b", { kind: "campaigns" }, [])).ok).toBe(true);
    const rows = tables.assist_saved_searches.filter((r) => r.brand_id === "b1");
    expect(rows.map((r) => r.label).sort()).toEqual(["mute_b", "work_b"]);
  });

  it("markSeen bumps last_checked_at (the job's compare-and-set then notices)", async () => {
    const { client, tables } = fakeDb({ assist_saved_searches: [{ id: "s1", brand_id: "b1", label: "x", filters: {}, seen_ids: ["a"], fresh_ids: ["b"], last_checked_at: "2026-10-01T00:00:00Z" }] });
    expect(await createAssistStore(() => client).markSeen("b1", "s1", ["b"])).toBe(true);
    const r = tables.assist_saved_searches[0];
    expect(r.seen_ids).toEqual(["a", "b"]);
    expect(r.fresh_ids).toEqual([]);
    expect(r.last_checked_at).not.toBe("2026-10-01T00:00:00Z");
  });

  it("the job pages through every saved search and every creator, in a stable order", async () => {
    // 1,497 mute rows (cheap) + 3 real searches; brand "b2"'s mute row sits past the old 1,000-row cut.
    const searches: any[] = Array.from({ length: 1497 }, (_, i) => ({ id: `id${String(i).padStart(5, "0")}`, brand_id: i === 1400 ? "b2" : `m${i}`, label: "eva_mute", filters: { kind: "mute" }, seen_ids: [], fresh_ids: [], last_checked_at: "2026-10-01T00:00:00Z" }));
    for (const b of ["b1", "b2", "b3"]) searches.push({ id: `z${b}`, brand_id: b, label: "x", filters: { city: "Jaipur" }, seen_ids: [], fresh_ids: [], last_checked_at: "2026-10-01T00:00:00Z" });
    const creators = Array.from({ length: 6500 }, (_, i) => ({ user_id: `c${String(i).padStart(5, "0")}`, name: `Creator ${i}`, profile_status: "approved", category: "Fashion", city: "Jaipur", followers_instagram: 20000 }));
    const { client, log } = fakeDb({ assist_saved_searches: searches, creator_profiles: creators });
    const sent: string[] = [];
    const r = await createAssistStore(() => client).checkSavedSearches({ notify: async (b) => { sent.push(b); } });
    expect(r.searches).toBe(1500);
    expect(log.some((l) => l.name === "creator_profiles" && l.order === "user_id")).toBe(true);
    expect(log.some((l) => l.name === "assist_saved_searches" && l.order === "id")).toBe(true);
    expect(log.filter((l) => l.name === "creator_profiles" && l.range).length).toBe(7); // 6,500 rows → 7 pages (was capped at 5)
    expect(sent.sort()).toEqual(["b1", "b3"]); // b2 is muted
  });

  it("routes: body cap, give-back on AI failure, DB export limit, creator intents, feedback logged", () => {
    const r = readFileSync("backend/assist_routes.ts", "utf8");
    expect(r).toContain("ASSIST_BODY_MAX = 64 * 1024");
    expect(r).toContain("store.giveBackUsage(key)");
    expect(r).toContain("limiter.giveBack(key)");
    expect(r).toContain("takeUsage(`export:${uid}`, 3)");
    expect(r).toContain('"alertsOff","invites"');
    expect(r).toContain("eva_feedback insert failed");
    expect(r).toContain("LIMIT - shared.used");
  });
});

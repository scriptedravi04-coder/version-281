// Session 43 (v284) — Supabase free-plan quota: fewer and lighter Supabase reads, same answers.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import { fetchLeanMessageWindows, fetchInboxProfiles, selectColumns, __resetLearnedColumns, LIGHT_MESSAGE_COLUMNS } from "./inboxLean";
import { reusableSignedUrl, rememberSignedUrl, __clearSignedUrlCache, MEDIA_URL_REUSE_MS, MEDIA_URL_TTL_SECONDS } from "./mediaAccess";
import { PUSH_IDLE_INTERVAL_MS, PUSH_KICK_DELAY_MS } from "./push_routes";

const read = (p: string) => fs.readFileSync(p, "utf8");

// Tiny fake of the supabase-js query builder: records every request, answers from `rows`.
function fakeClient(rows: Record<string, any[]>, opts: { missing?: string[] } = {}) {
  const log: any[] = [];
  const from = (table: string) => {
    const q: any = { table, cols: "*", filters: [] as any[], count: false, lim: 0, asc: true };
    const b: any = {
      select(cols: string, o?: any) { q.cols = cols; q.count = Boolean(o?.count); return b; },
      eq(c: string, v: any) { q.filters.push((r: any) => r[c] === v); return b; },
      in(c: string, v: any[]) { q.filters.push((r: any) => v.includes(r[c])); return b; },
      or() { q.filters.push((r: any) => !r.read); return b; },
      order(_c: string, o: any) { q.asc = o?.ascending !== false; return b; },
      limit(n: number) { q.lim = n; return b; },
      then(res: any, rej: any) {
        log.push({ table, cols: q.cols, count: q.count });
        const wanted = q.cols === "*" ? [] : q.cols.split(",").map((c: string) => c.trim());
        const miss = wanted.map((c: string) => c.split(":").pop()!.split("->")[0]).find((c: string) => (opts.missing || []).includes(c));
        if (miss) return Promise.resolve({ data: null, error: { code: "42703", message: `column ${table}.${miss} does not exist` } }).then(res, rej);
        let data = (rows[table] || []).filter((r) => q.filters.every((f: any) => f(r)));
        const total = data.length;
        data = [...data].sort((a, b) => (q.asc ? 1 : -1) * String(a.created_at).localeCompare(String(b.created_at)));
        if (q.lim) data = data.slice(0, q.lim);
        if (q.cols !== "*") data = data.map((r) => {
          const o: any = {};
          for (const c of wanted) {
            if (c.includes(":")) { const [alias, path] = c.split(":"); const [col, key] = path.split("->>"); o[alias] = r[col]?.[key] ?? null; }
            else o[c] = r[c];
          }
          return o;
        });
        return Promise.resolve({ data, error: null, count: q.count ? total : null }).then(res, rej);
      },
    };
    return b;
  };
  return { client: { from }, log };
}

const msgs = [
  { message_id: "m1", thread_id: "t1", created_at: "2026-10-01T00:00:01Z", text: "hi", sender_user_id: "a", read: true, message_type: "text", metadata: { big: "x".repeat(5000) } },
  { message_id: "m2", thread_id: "t1", created_at: "2026-10-01T00:00:02Z", text: "links", sender_user_id: "b", read: true, message_type: "live_links_submitted", metadata: { action: "live_link_submitted", big: "y".repeat(5000) } },
  { message_id: "m3", thread_id: "t1", created_at: "2026-10-01T00:00:03Z", text: "latest", sender_user_id: "b", read: false, message_type: "text", metadata: { attachment: "f.png" } },
  { message_id: "m4", thread_id: "t2", created_at: "2026-10-01T00:00:04Z", text: "only one", sender_user_id: "a", read: false, message_type: "text", metadata: {} },
];

beforeEach(() => __resetLearnedColumns());

describe("inbox message windows (lean)", () => {
  it("one request per thread + one batch for last messages; same result shape", async () => {
    const { client, log } = fakeClient({ chat_messages: msgs });
    const r: any = await fetchLeanMessageWindows(client, ["t1", "t2"], "a", 60);
    expect(r.windows.t1.map((m: any) => m.message_id)).toEqual(["m1", "m2", "m3"]);
    expect(r.totals).toEqual({ t1: 3, t2: 1 });
    expect(r.unread).toEqual({ t1: 1 }); // m3 from b is unread for a; m4 is a's own
    // last message is whole (text, metadata) — older ones are light but keep the link action
    expect(r.windows.t1[2]).toMatchObject({ text: "latest", metadata: { attachment: "f.png" } });
    expect(r.windows.t1[1].metadata).toEqual({ action: "live_link_submitted" });
    expect(r.windows.t1[0].text).toBeUndefined();
    const windowReads = log.filter((l) => l.table === "chat_messages" && l.count);
    expect(windowReads).toHaveLength(2); // was 4 (window + separate count per thread)
    expect(log.filter((l) => l.cols === "*")).toHaveLength(1); // the batched last-message read
  });

  it("a column missing in this database is dropped once and remembered", async () => {
    const { client, log } = fakeClient({ chat_messages: msgs }, { missing: ["type"] });
    const r: any = await fetchLeanMessageWindows(client, ["t1"], "a", 60);
    expect(r.windows.t1).toHaveLength(3);
    const before = log.length;
    await fetchLeanMessageWindows(client, ["t1"], "a", 60);
    expect(log.length - before).toBe(3); // window + last-message batch + unread, no retry
    expect(LIGHT_MESSAGE_COLUMNS).toContain("type");
  });

  it("any other error → null, so server.ts uses the old full read", async () => {
    const client = { from: () => { const b: any = { select: () => b, eq: () => b, in: () => b, or: () => b, order: () => b, limit: () => b,
      then: (res: any) => Promise.resolve({ data: null, error: { code: "57014", message: "timeout" } }).then(res) }; return b; } };
    expect(await fetchLeanMessageWindows(client, ["t1"], "a", 60)).toBeNull();
    expect(read("backend/server.ts")).toContain("const lean = await fetchLeanMessageWindows(client, threadIds, currentUserId, MESSAGE_WINDOW);");
  });
});

describe("inbox profiles", () => {
  it("only name + picture columns; falls back to * when nothing usable", async () => {
    const { client, log } = fakeClient({
      users: [{ user_id: "a", name: "A", picture: "p", bio: "x".repeat(9000) }],
      brand_profiles: [{ user_id: "a", company_name: "Co", logo: "l", huge: "z" }],
      creator_profiles: [{ user_id: "a", name: "C", picture: "cp" }],
    }, { missing: ["photo", "full_name"] });
    const [u, bp, cp]: any = await fetchInboxProfiles(client, ["a"]);
    expect(u.data[0]).toEqual({ user_id: "a", name: "A", picture: "p" });
    expect(bp.data[0]).toEqual({ user_id: "a", company_name: "Co", logo: "l" });
    expect(cp.data[0].picture).toBe("cp");
    expect(log.some((l) => l.cols === "*")).toBe(false);
    const all = await selectColumns("t", ["x"], async (c) => (c === "*" ? { data: [1], error: null } : { data: null, error: { code: "42703", message: "column t.x does not exist" } }));
    expect(all.data).toEqual([1]);
  });
});

describe("other quota fixes", () => {
  it("video links are reused for 5 minutes, then signed again", () => {
    __clearSignedUrlCache();
    const ref = { bucket: "content-submissions", path: "ugc-videos/a.mp4" };
    rememberSignedUrl(ref, "https://s/sign?token=1", 1000);
    expect(reusableSignedUrl(ref, 1000 + 60_000)).toEqual({ url: "https://s/sign?token=1", expiresIn: MEDIA_URL_TTL_SECONDS - 60 });
    expect(reusableSignedUrl(ref, 1000 + MEDIA_URL_REUSE_MS)).toBeNull();
    expect(MEDIA_URL_REUSE_MS * 3).toBeLessThanOrEqual(MEDIA_URL_TTL_SECONDS * 1000);
    expect(read("backend/media_routes.ts")).toContain("req.query?._r ? null : reusableSignedUrl(ref)");
  });

  it("push loop idles at 60 s and every notification insert kicks it", () => {
    expect(PUSH_IDLE_INTERVAL_MS).toBe(60000);
    expect(PUSH_KICK_DELAY_MS).toBeLessThan(5000);
    expect(read("backend/server.ts")).toContain("kickPushLoop(); // v284");
    expect(read("backend/push_routes.ts")).not.toContain("setInterval(tick, 20000)");
  });

  it("startup brief check reads order counts in pages, not one request per brief", () => {
    const s = read("backend/server.ts");
    expect(s).toContain(".from('ugc_orders').select('brief_id').order('id', { ascending: true }).range(from, from + 999)");
    expect(s).not.toContain(".eq('brief_id', b.id || 'null')");
  });
});

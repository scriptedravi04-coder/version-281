// Session 43 (v284): GETs asked while the page is hidden wait for the page to be visible and the
// same URL becomes one request. POSTs are never held.
import { describe, it, expect, vi, afterEach } from "vitest";
import api, { __heldGetCount } from "./api";

let state = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
const setVisibility = (v) => { state = v; document.dispatchEvent(new Event("visibilitychange")); };

afterEach(() => { setVisibility("visible"); vi.restoreAllMocks(); });

describe("api GET while the page is hidden", () => {
  it("waits, merges repeats into one request, then runs when visible", async () => {
    const calls = [];
    api.defaults.adapter = async (config) => { calls.push(config.url); return { data: { ok: config.url }, status: 200, statusText: "OK", headers: {}, config }; };
    setVisibility("hidden");
    const a = api.get("/api/chat/v2/threads?x=1", { useCache: false });
    const b = api.get("/api/chat/v2/threads?x=1", { useCache: false });
    const c = api.get("/api/notifications?x=2", { useCache: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
    expect(__heldGetCount()).toBe(2);
    setVisibility("visible");
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(ra.data).toEqual(rb.data);
    expect(rc.data.ok).toContain("/api/notifications");
    expect(calls.filter((u) => u.includes("threads"))).toHaveLength(1);
    expect(__heldGetCount()).toBe(0);
  });

  it("does not hold POSTs or a GET marked allowWhileHidden", async () => {
    const calls = [];
    api.defaults.adapter = async (config) => { calls.push(`${config.method} ${config.url}`); return { data: {}, status: 200, statusText: "OK", headers: {}, config }; };
    setVisibility("hidden");
    await api.post("/api/payments/razorpay/check-status", {});
    await api.get("/api/urgent?y=1", { useCache: false, allowWhileHidden: true });
    expect(calls).toEqual(["post /api/payments/razorpay/check-status", "get /api/urgent?y=1"]);
  });

  it("runs straight away when visible", async () => {
    const calls = [];
    api.defaults.adapter = async (config) => { calls.push(config.url); return { data: {}, status: 200, statusText: "OK", headers: {}, config }; };
    await api.get("/api/me?z=1", { useCache: false });
    expect(calls).toEqual(["/api/me?z=1"]);
  });
});

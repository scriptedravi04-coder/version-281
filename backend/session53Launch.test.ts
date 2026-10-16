import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { chatsFromRows, cleanChatId, cleanHistoryRows, LEGACY_CHAT } from "./assist_store";

const read = (p: string) => readFileSync(p, "utf8");

describe("v303 · launch audit — security guards stay in place", () => {
  it("sign-up only makes creators / brands; password login needs a verified email", () => {
    const s = read("backend/auth_routes.ts");
    expect(s).toContain('const role = req.body?.role === "creator" || req.body?.role === "brand" ? req.body.role : null;');
    expect(s).toContain('code: "EMAIL_NOT_VERIFIED"');
    expect(s).not.toContain('}, "*");');
  });
  it("only the right person can approve UGC, post in a chat, submit a draft, sign their side", () => {
    expect(read("backend/campaign_lifecycle.ts")).toContain("if (ugcRole !== 'brand' && ugcRole !== 'admin') return forbid(res, 'brand');");
    const chat = read("backend/chat_routes.ts");
    expect(chat).toContain("if (!postIsStaff && !isThreadCreator && !isThreadBrand)");
    expect(chat).toContain("req.body?.message_type === 'system' && !postIsStaff ? 'text'");
    expect(read("backend/deals_routes.ts")).toContain("Only the creator on this deal can submit its draft.");
    expect(read("backend/deals_chat_routes.ts")).toContain("isCreator = creatorId ? String(user.user_id) === String(creatorId)");
  });
  it("every payment must cover what is recorded; AI brief needs a brand login", () => {
    expect(read("backend/payment_routes.ts")).toContain('if (grossAmount > 0 && !getIsTestMode() && !String(razorpay_order_id || "").startsWith("order_test_")) {');
    expect(read("backend/ugc_routes.ts")).toContain('if (!aiUser) return res.status(401).json({ error: "Please log in." });');
  });
  it("banned / deleted sessions stop working; uploads limited; profile form can't change the login email", () => {
    const s = read("backend/server.ts");
    expect(s).toContain("if (u && (u.banned === true || u.is_deleted === true)) return null;");
    expect(s).toContain('app.use(express.json({ limit: "25mb" }));');
    expect(read("backend/misc_routes.ts")).toContain("const UPLOAD_BUCKETS = [");
    expect(read("backend/misc_routes.ts")).toContain("report_id: crypto.randomUUID(),");
    expect(read("backend/creators_routes.ts")).toContain("the LOGIN email is never changed from the profile form");
    expect(read("backend/creators_routes.ts")).not.toContain("usr.email = profileData.email;");
  });
  it("no made-up reviews or Instagram numbers", () => {
    const pv = read("src/pages/creator/CreatorPublicView.jsx");
    expect(pv).not.toContain("fakeTotalReviewsCount");
    expect(pv).not.toContain("fakeRating");
    const ac = read("src/pages/collabs/AddCollab.jsx");
    expect(ac).not.toContain("Math.random()");
    expect(ac).toContain('fetch_status: "MANUAL"');
  });
});

describe("v303 · Eva keeps several chats", () => {
  it("chat ids are short and safe", () => {
    expect(cleanChatId("c1abc_-")).toBe("c1abc_-");
    expect(cleanChatId("x'; drop")).toBe(null);
    expect(cleanChatId("")).toBe(null);
  });
  it("rows group into chats, newest first, titled by the first question", () => {
    const rows = [
      { chat_id: null, role: "user", text: "old one", created_at: "2026-10-01" },
      { chat_id: "a", role: "user", text: "Diwali plan", created_at: "2026-10-10" },
      { chat_id: "a", role: "bot", text: "ok", created_at: "2026-10-10T01" },
      { chat_id: "b", role: "user", text: "Jaipur creators", created_at: "2026-10-12" },
    ];
    const chats = chatsFromRows(rows);
    expect(chats.map((c: any) => c.chat_id)).toEqual(["b", "a", LEGACY_CHAT]);
    expect(chats[1].title).toBe("Diwali plan");
    expect(chats[1].count).toBe(2);
  });
  it("saved rows carry the chat id", () => {
    const rows = cleanHistoryRows({ chat_id: "c9", messages: [{ user: true, text: "hi" }] }, "b1", "u1");
    expect(rows[0].chat_id).toBe("c9");
  });
  it("the chat says How can I help, shows Ybex Eva · BETA and a menu", () => {
    const s = read("src/components/feedback/FeedbackBot.jsx");
    expect(s).toContain("How can I help?");
    expect(s).toContain('data-testid="eva-menu"');
    expect(s).toContain('data-testid="eva-new-chat"');
    expect(s).toContain("const STATUS_TOP = TH.base;");
  });
});

// Session 58 — sign-in hole, "direct apna animation" launch (Android + iPhone), fewer emails.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { UGC_IN_APP_ONLY } from "./services/ugcDeadlineService";
import { fairQuote, quoteCheck, pitchCheck, pendingInvites, detectCreatorIntent } from "../src/components/assist/creator/creatorLogic";
import { countFullAdmins, adminTargetBlock } from "./adminTargetGuard";
import { chatBlockedUntil } from "./chatRestriction";
import { langOf } from "./campaigns_routes";
import { blockedSwitch, blockedReply, readEvaSettings, filterChats } from "../src/components/feedback/evaSettings";
import { chatsFromRows, cleanFilters, cleanEvaSettings } from "./assist_store";
import { cleanAssistBody, evaExportChat } from "./assist_routes";
import { detectBrandIntent, parseCreatorQuery, refineCreators, templateScript, CLEAR_CHAT, NEW_CHAT, computeAlerts } from "../src/components/assist/brand/brandLogic";
import { applyOpenReason, countMatchingCreators } from "./campaignManage";
import { kycApproved } from "./inviteRewards";
import { safeExt } from "../src/lib/fileExt";
import { riskControlsFromRow, campaignBudgetProblem } from "./riskControls";
import { campaignTargeting as campaignTargetingQ14 } from "./campaignTargeting";
import { reminderSpacing } from "./services/ugcDeadlineService";
import { getChatStage as stageQ16, getInboxChip as chipQ16 } from "../src/components/chat/mobile/chatStageMap";
import { SESSION_MS, clientIp as clientIpQ8 } from "./authSecurity";
import { requiredAdminPermission } from "./adminPermissions";
import { sanitizeHtml } from "./htmlSanitize";
import { campaignTargeting } from "./campaignTargeting";
import { isRefunded, netAfterPartialRefund } from "./adminMoney";
import { pickCreatorCoupon } from "./creatorCoupons";

const read = (p: string) => readFileSync(p, "utf8");

describe("v309 · verify-email never logs in an already-verified account", () => {
  it("returns ALREADY_VERIFIED instead of a session, and the screen sends the user to login", () => {
    const a = read("backend/auth_routes.ts");
    expect(a).toContain('code: "ALREADY_VERIFIED"');
    expect(read("src/components/onboarding/PreStep_EmailVerify.tsx")).toContain('"ALREADY_VERIFIED"');
  });
});

describe("v309 · launch goes straight into our animation", () => {
  it("Android launch screen is plain purple (no second logo), purple nav bar, new app version", () => {
    const m = JSON.parse(read("twa-manifest.json"));
    expect(m.iconUrl).toBe("/twa-splash-512.png");
    expect(m.backgroundColor).toBe("#7E00DC");
    expect(m.navigationColor).toBe("#7E00DC");
    expect(m.appVersionCode).toBeGreaterThanOrEqual(3);
  });
  it("Android starts flat #7E00DC, iPhone strip is purple from frame one, shine ends before the exit", () => {
    const h = read("index.html");
    expect(h).toContain('document.documentElement.classList.add("yb-android")');
    expect(h).toContain("html.yb-splash-active body { background: #9B00FF !important; }");
    expect(h).toContain("#yb-splash.p5 .sh{transform:translateX(1400px);transition:transform 340ms");
    expect(h).toContain("var HOLD = 40, INTRO = reduce ? 200 : HOLD + 1210;");
  });
});

describe("v309 · fewer emails (bell + phone push still go)", () => {
  it("warning / suspend / ban never email the user", () => {
    const n = read("backend/notificationService.ts");
    expect(n).toContain('"WARNING", "ACCOUNT_WARNING", "SUSPEND"');
    expect(n).toContain("['CAMPAIGN_UNDER_REVIEW', 'VERIFICATION', 'WARNING', 'SUSPEND', 'BAN']");
  });
  it("UGC repeat reminders and FYI notices are in-app + push only; money / cancel / final reminder still email", () => {
    expect(UGC_IN_APP_ONLY.has("UGC_REMINDER_REPEAT")).toBe(true);
    expect(UGC_IN_APP_ONLY.has("UGC_BRIEF_RELISTED")).toBe(true);
    for (const t of ["UGC_REMINDER_FIRST", "UGC_REMINDER_FINAL", "UGC_REFUND_SENT", "UGC_ORDER_EXPIRED", "UGC_ORDER_CANCELLED_BY_BRAND"]) {
      expect(UGC_IN_APP_ONLY.has(t)).toBe(false);
    }
  });
});

describe("v309 · admins can be deleted when more than one full admin exists", () => {
  it("counts admins even though the live users table has no is_admin column", async () => {
    const admins = [{ user_id: "a1", role: "admin" }, { user_id: "a2", role: "admin" }, { user_id: "a3", role: "admin", is_deleted: true }];
    const client = {
      from: () => ({
        select: (cols: string) => {
          const res = cols.includes("is_admin") ? { data: null, error: { message: "column users.is_admin does not exist" } } : { data: admins, error: null };
          return { or: async () => res, eq: async () => res };
        },
      }),
    };
    const n = await countFullAdmins(client, { users: [{ user_id: "a1", role: "admin" }] });
    expect(n).toBe(2);
    expect(adminTargetBlock({ user_id: "a1", role: "admin" }, { user_id: "a2", role: "admin" }, n)).toBeNull();
    expect(adminTargetBlock({ user_id: "a1", role: "admin" }, { user_id: "a1", role: "admin" }, n)?.code).toBe("SELF");
    expect(adminTargetBlock({ user_id: "a1", role: "admin" }, { user_id: "a2", role: "admin" }, 1)?.code).toBe("LAST_ADMIN");
  });
});

import { channelFrom, sourceRow } from "./signupSource";
import { buildGrowthReport } from "./adminGrowth";

describe("v309 · signup source (Growth → where signups come from)", () => {
  it("names the channel from ad tags or the referring site", () => {
    expect(channelFrom({ utm_source: "instagram" })).toBe("instagram");
    expect(channelFrom({ utm_source: "ig", utm_medium: "paid_social" })).toBe("meta_ads");
    expect(channelFrom({ referrer: "https://www.google.com/" })).toBe("google");
    expect(channelFrom({ gclid: 1 })).toBe("google_ads");
    expect(channelFrom({ referrer: "https://l.instagram.com/?u=x" })).toBe("instagram");
    expect(channelFrom({ referrer: "android-app://ai.studio.ybexapp" })).toBe("android_app");
    expect(channelFrom({ referrer: "https://someblog.in/post" })).toBe("other_website");
    expect(channelFrom({})).toBe("direct");
    expect(sourceRow({ utm_source: "Insta<script>", utm_campaign: "Diwali Sale" })).toMatchObject({ utm_source: "instascript", utm_campaign: "diwali sale" });
  });
  it("splits non-referral signups by source once the column exists", () => {
    const NOW = new Date("2026-10-15T00:00:00Z");
    const users = [
      { user_id: "u1", role: "creator", created_at: "2026-10-10", signup_source: "instagram" },
      { user_id: "u2", role: "creator", created_at: "2026-10-10", signup_source: "instagram" },
      { user_id: "u3", role: "brand", created_at: "2026-10-10", signup_source: "google" },
      { user_id: "u4", role: "brand", created_at: "2026-09-01", signup_source: null },
      { user_id: "u5", role: "creator", created_at: "2026-10-10", signup_source: "direct" },
    ];
    const r = buildGrowthReport({ users, referrals: [{ referred_id: "u5", status: "PENDING" }], sourceTracked: true } as any, NOW);
    const ch = Object.fromEntries(r.acquisition.channels.map((c: any) => [c.key, c.count]));
    expect(ch).toEqual({ referral: 1, src_instagram: 2, src_google: 1, other: 1 });
    expect(r.acquisition.trackingGap).toBe(false);
    expect(r.insights.map((i: any) => i.id)).not.toContain("tracking-gap");
    expect(read("backend/server.ts")).toContain("setupSignupSourceRoutes(router, { supabase, privilegedSupabase, parseAuthUser });");
    expect(read("src/contexts/AuthContext.jsx")).toContain("sendSignupSource(api, user)");
  });
});

import { hasRefund } from "./refundFlags";
import { isEscrowDepositRow } from "./campaignGuards";
import { readyRows } from "./creatorPayoutRequests";

describe("v310 · one deal is never counted twice", () => {
  it("refund_status 'NONE' / refund_amount 0 (DB defaults) are not refunds", () => {
    expect(hasRefund({ refund_status: "NONE", refund_amount: 0 })).toBe(false);
    expect(hasRefund({ refund_status: "NONE", refund_amount: "0" })).toBe(false);
    expect(hasRefund({ refund_status: "PENDING" })).toBe(true);
    expect(hasRefund({ refund_amount: 500 })).toBe(true);
    expect(isEscrowDepositRow({ status: "SUCCESS", refund_status: "NONE", refund_amount: 0 })).toBe(true);
  });
  it("a payout request counts each deal once", () => {
    const rows = [
      { id: "a", deal_id: "d1", status: "SUCCESS", payout_status: "PENDING", creator_net_amount: 11700 },
      { id: "b", deal_id: "d1", status: "SUCCESS", payout_status: "RELEASED", creator_net_amount: 11700 },
    ];
    const r = readyRows(rows, { approvedDealIds: new Set(["d1"]) });
    expect(r.map((x: any) => x.id)).toEqual(["b"]);
  });
});

describe("v310 · phone fixes", () => {
  it("rates: one set of keys, all sent, saving shown; back returns to Eva", () => {
    const rs = read("src/pages/creator/profileScreens/RatesScreen.jsx");
    expect(rs).toContain('{ id: "stories", label: "Instagram Story (with link)"');
    expect(rs).toContain('{saving ? "Saving…" : "Save rate cards"}');
    const cs = read("src/pages/creator/CreatorSettings.jsx");
    expect(cs).toContain("reel_rate: Number(rc.reels) || 0,");
    expect(cs).toContain('window.dispatchEvent(new Event("ybex:open-eva"))');
    expect(read("src/components/feedback/FeedbackBot.jsx")).toContain('window.addEventListener("ybex:open-eva", h);');
  });
  it("link drafts open as a link; resubmit asks in one place; menu popups sit above the chat", () => {
    expect(read("src/components/chat/mobile/MobileDeliverableCard.jsx")).toContain("export function isLinkDraft(url)");
    expect(read("src/components/chat/mobile/MobileLiveLinksCard.jsx")).toContain("onClick={() => (onReject ? onReject() : setRejectOpen(true))}");
    expect(read("src/components/chat/BurgerMenuSupport.jsx")).not.toContain('className="fixed inset-0 z-50 overflow-y-auto');
    expect(read("backend/notificationService.ts")).toContain("💸 Payout request waiting");
  });
});

describe("v310 · home campaigns, footer line, sign card, payout flicker", () => {
  it("wired", () => {
    expect(read("src/pages/creator/CreatorHomeMobile.jsx")).toContain("<HomeCampaignCard");
    const card = read("src/components/campaigns/mobile/HomeCampaignCard.jsx");
    expect(card).toContain("campaignStatsFor(c, user)");
    expect(card).toContain("Per creator");
    expect(read("src/components/layout/PremiumFooter.jsx")).not.toContain("mt-8 md:mt-12 border-t");
    expect(read("src/components/chat/mobile/ChatBoxMobile.jsx")).toContain('data-testid="inline-sign-agreement"');
    // v333 (requirement change): the "loaded" flag now comes from the shared payout-row hook — still no flicker.
    expect(read("src/components/chat/mobile/MobilePayoutCard.jsx")).toContain("loaded: txLoaded");
  });
});

import { prepareCsvRows, mobileKey, handleKey } from "./waitlistCsvImport";

describe("v310 · waitlist CSV skips people already on Ybex", () => {
  it("by email, mobile or Instagram handle — and inside the same file", () => {
    const rows = [
      { name: "A", email: "a@x.com", mobile: "9876543210", instagram: "@aaa" },
      { name: "B", email: "b@x.com", mobile: "+91 98765 00000", instagram: "bbb" },
      { name: "C", email: "c@x.com", instagram: "https://instagram.com/ccc/" },
      { name: "D", email: "d@x.com", mobile: "9000000001" },
      { name: "E", email: "e@x.com", mobile: "9000000001" },
      { name: "F", email: "old@x.com" },
    ];
    const r = prepareCsvRows(rows, new Set(["old@x.com"]), new Set(), { mobiles: new Set([mobileKey("9876500000")]), handles: new Set([handleKey("CCC")]) });
    expect(r.map((x) => x.status)).toEqual(["ok", "duplicate", "duplicate", "ok", "duplicate", "duplicate"]);
    expect(r[1].reason).toMatch(/mobile/);
    expect(r[2].reason).toMatch(/Instagram/);
    expect(r[4].reason).toMatch(/twice/);
  });
});

import { moodFor, shortPart, peekLines, BRAND_STARTERS, CREATOR_STARTERS } from "../src/components/feedback/evaUi.jsx";
import { detectBrandIntent } from "../src/components/assist/brand/brandLogic.js";

describe("v312 · Ybex Eva part 1 (design handoff)", () => {
  it("each Eva message gets a face from its words; colour never changes", () => {
    expect(moodFor("Sorry, that failed")).toBe("whoa");
    expect(moodFor("Psst… a brand invited you")).toBe("wink");
    expect(moodFor("Your payout of ₹11,700 is ready")).toBe("proud");
    expect(moodFor("Found 6 creators")).toBe("excited");
    expect(moodFor("Which city?")).toBe("hmm");
    expect(moodFor("Hi there")).toBe("hello");
  });
  it("long replies fold behind Show more; peek lines rotate with the first name", () => {
    expect(shortPart("a ".repeat(200)).length).toBeLessThan(200);
    expect(shortPart("short")).toBe("short");
    expect(peekLines("creator", "Priya")[0][0]).toBe("Hello Priya!");
  });
  it("starter boxes are English and reach the right Eva features", () => {
    expect(BRAND_STARTERS.map((s) => s.title)).toEqual(["Find creators", "New campaign", "UGC videos", "What can you do?"]);
    expect(CREATOR_STARTERS.map((s) => s.title)).toEqual(["Campaigns for me", "When is my payout?", "Brand invitations", "What can you do?"]);
    expect(detectBrandIntent("I need UGC videos")?.intent).toBe("ugcCreate");
    expect(detectBrandIntent("Create a new campaign")?.intent).toBe("campaignCreate");
  });
  it("chat: name Ybex Eva everywhere, disclaimer, 👍/👎 to the server, opens empty", () => {
    const s = read("src/components/feedback/FeedbackBot.jsx");
    expect(s).toContain('data-testid="eva-disclaimer"');
    expect(s).toContain('api.post("assist/feedback"');
    expect(s).toContain('data-testid="eva-empty-brand"');
    expect(s).toContain('data-testid="eva-empty-creator"');
    expect(read("backend/assist_routes.ts")).toContain('router.post("/assist/feedback"');
    expect(read("backend/assist_routes.ts")).toContain('Always call yourself "Ybex Eva" (never "Ybex Assist").');
    expect(read("src/components/feedback/assistBrain.js")).not.toContain("I'm Ybex Assist");
  });
});

import { nextUgcQuestion, nextCampaignQuestion, readCampaignAnswer, campaignBuilderDraft, parseCreatorQuery } from "../src/components/assist/brand/brandLogic.js";

describe("v313 · Ybex Eva part 2 (brand flows)", () => {
  it("UGC brief asks in English, one question at a time, in a question box", () => {
    const q = nextUgcQuestion({});
    expect(q).toMatchObject({ field: "product_name", label: "UGC BRIEF", step: 1, total: 5, input: true });
    expect(q.ask).toMatch(/^What is it for\?/);
    expect(nextUgcQuestion({ product_name: "Serum" }).chips.length).toBe(3);
  });
  it("campaign builder: 9 steps in the screen's order, brief min 15 chars, then a draft for Review & launch", () => {
    let c = {};
    const answers = { campaignTitle: "Diwali launch", requirementsText: "A 30s reel with our serum at night", selectedCategories: "Fashion", selectedPlatforms: "Instagram", selectedFollowerRanges: "Micro", payout: "8000-18000", deliverablesText: "1 Reel", deadline: "14", advanced: "keep" };
    expect(readCampaignAnswer("requirementsText", "too short", c).error).toBe("Please enter a creative brief (minimum 15 characters).");
    let n = 0;
    for (let q = nextCampaignQuestion(c); q; q = nextCampaignQuestion(c)) {
      n += 1; expect(q.step).toBe(n); expect(q.total).toBe(9);
      const r = readCampaignAnswer(q.field, answers[q.field], c); expect(r.error).toBeNull(); c = r.c;
    }
    expect(n).toBe(9);
    const d = campaignBuilderDraft(c);
    expect(d).toMatchObject({ campaignTitle: "Diwali launch", selectedCategories: ["Fashion"], budgetMin: "8000", budgetMax: "18000", deliverablesText: "1 Reel", gender: "Any" });
    expect(d.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("rates stay private: budget filters, never shown", () => {
    expect(parseCreatorQuery("Jaipur fashion creators under 9000").maxRate).toBe(9000);
    expect(parseCreatorQuery("fashion creators under 10k followers").maxRate).toBe(0);
    const cards = read("src/components/assist/brand/AssistCards.jsx");
    expect(cards).not.toContain('"Lowest rate"');
    expect(cards).not.toContain('"Reach / ₹1k"');
    expect(cards).toContain('data-testid="assist-question"');
    expect(read("src/components/explore/mobile/ExploreMobile.jsx")).toContain("Everyone here fits up to ${rupees(budget)} per creator");
    expect(read("src/components/campaigns/mobile/MobileCampaignCreate.jsx")).toContain('return v === "review" || v === "advanced" ? v : "step1";');
  });
});

describe("v314 · Eva for creators (handoff part 3)", () => {
  it("one rate rule: around ₹0.30 per average view; quote ₹100–₹50,00,000; pitch 20–500", () => {
    expect(fairQuote(15000)).toBe(4500);
    expect(fairQuote(0)).toBe(0);
    expect(quoteCheck(15000, 6000)).toMatchObject({ ok: true, level: "warn", fair: 4500 });
    expect(quoteCheck(15000, 6000).message).toBe("⚠️ Heads up! For your reach, a competitive rate would be around ₹4,500 (₹0.30/view). Your quoted charges are higher — you can still submit, brands may negotiate.");
    expect(quoteCheck(15000, 4500)).toMatchObject({ ok: true, level: "good", message: "✅ Your charges look justified for your reach." });
    expect(quoteCheck(15000, 50).ok).toBe(false);
    expect(quoteCheck(15000, 6000000).ok).toBe(false);
    expect(quoteCheck(15000, "").level).toBe("empty");
    expect(pitchCheck("hi")).toMatchObject({ short: true, ok: false, label: "2/500 · min 20" });
    expect(pitchCheck("x".repeat(25)).ok).toBe(true);
  });
  it("understands invites and 'what should I charge', in English and Hinglish", () => {
    const cases: Record<string, string> = {
      "What should I charge?": "rate", "how much should I charge for a reel": "rate", "mera rate kitna hona chahiye": "rate",
      "Do I have any brand invites?": "invites", "show my invitations": "invites", "pending invites": "invites",
      "invite a friend": "refer", "Show campaigns for me": "campaigns",
    };
    for (const [t, want] of Object.entries(cases)) expect(detectCreatorIntent(t)?.intent, t).toBe(want);
    expect(pendingInvites({ pending: [{ id: "a" }, { x: 1 }] }).map((i: any) => i.id)).toEqual(["a"]);
    expect(pendingInvites({ invitations: [{ id: "a", status: "accepted" }, { id: "b", status: "pending_creator_acceptance" }] }).map((i: any) => i.id)).toEqual(["b"]);
  });
  it("cards: swipe row with Apply in 1 tap, full apply form, invites reuse the app's review popup; replies in English", () => {
    const cards = read("src/components/assist/creator/CreatorCards.jsx");
    for (const s of ["Apply in 1 tap", "Pitch to brand", "Your quote (₹)", "Send application", "✓ Application sent", "Accept & open deal room", "CreatorReviewInvitationModal", "ACCEPTED", "DECLINED", "Around {inr(d.fair)}"]) expect(cards, s).toContain(s);
    expect(cards).not.toContain("api.");
    const brain = read("src/components/assist/creator/brain.js");
    for (const s of ["cheez", "naye kaam", "Aapki profile ${ps.score}% complete", "mere liye campaigns dikhao"]) expect(brain, s).not.toContain(s);
    expect(brain).toContain('case "invites"');
    expect(read("src/components/assist/creator/tools.js")).toContain('api.get("creators/invitations"');
    // the brand creators row leaves room for the tile glow (Ravi: "glow cut kyu ho raha hai")
    expect(read("src/components/assist/brand/AssistCards.jsx")).toContain('padding: "26px 22px 34px", margin: "-20px -22px -24px"');
  });
});

describe("v315 · Eva part 4: history, settings, attach, desktop", () => {
  it("permissions: Deals & offers / Earnings switches stop Eva reading that data and say which switch to turn on", () => {
    const off = { deals: false, money: true, lang: "en" };
    expect(blockedSwitch("creator", "invites", off)).toBe("deals");
    expect(blockedSwitch("creator", "due", off)).toBe("deals");
    expect(blockedSwitch("brand", "applicants", off)).toBe("deals");
    expect(blockedSwitch("creator", "earnings", off)).toBe(null);
    expect(blockedSwitch("creator", "earnings", { deals: true, money: false, lang: "en" })).toBe("money");
    expect(blockedSwitch("creator", "campaigns", { deals: false, money: false, lang: "en" })).toBe(null);
    expect(blockedReply("creator", "money")).toContain('switch on "Earnings & payouts" in Eva settings');
    expect(readEvaSettings("nobody")).toEqual({ deals: true, money: true, lang: "en" });
    for (const f of ["src/components/assist/creator/brain.js", "src/components/assist/brand/brain.js"]) expect(read(f), f).toContain("blockedSwitch(");
  });
  it("history: search by title and last line; chats carry a preview; reopened chats offer 'Show it again'", () => {
    const list = [{ title: "Show campaigns", preview: "4 open for you" }, { title: "Rates", preview: "around ₹4,500" }];
    expect(filterChats(list, "4,500").map((c: any) => c.title)).toEqual(["Rates"]);
    expect(filterChats(list, "").length).toBe(2);
    expect(chatsFromRows([{ chat_id: "a", role: "user", text: "hi", created_at: "1" }, { chat_id: "a", role: "bot", text: "Hello!", created_at: "2" }])[0].preview).toBe("Hello!");
    const bot = read("src/components/feedback/FeedbackBot.jsx");
    for (const s of ['label: "Show it again"', "No chats yet — tap New chat to start.", 'data-testid="eva-chat-search"', 'data-testid="eva-settings-open"']) expect(bot, s).toContain(s);
  });
  it("reply language goes to the AI; the 'Notify me' switch is one mute row the alert job respects", () => {
    expect(cleanAssistBody({ task: "write", text: "hi", lang: "hinglish" }).lang).toBe("hinglish");
    expect(cleanAssistBody({ task: "write", text: "hi", lang: "klingon" }).lang).toBe("");
    expect(cleanFilters({ kind: "mute" }).kind).toBe("mute");
    const store = read("backend/assist_store.ts");
    expect(store).toContain('muted.has(String(s.brand_id))');
    expect(read("src/components/assist/brand/tools.js")).toContain('x?.label !== "eva_mute"');
    expect(evaExportChat("Rates", [{ user: true, text: "What should I charge?", at: "2026-10-15T10:00:00Z" }])).toBe("=== Rates ===\n[2026-10-15 10:00] You: What should I charge?");
    const panels = read("src/components/feedback/EvaPanels.jsx");
    for (const s of ["Tap again to clear everything", "✓ Sent to your email", "Download my Eva chats", "Reply language", "Notify me from Eva"]) expect(panels, s).toContain(s);
  });
  it("📎 sheet (Photo / Screenshot / Document) and the desktop panel (520px docked ≥1100, drawer below, mobile Eva <768)", () => {
    const panels = read("src/components/feedback/EvaPanels.jsx");
    for (const k of ["eva-attach-${k}", '["photo", "Photo"', '["screenshot", "Screenshot"', '["doc", "Document"']) expect(panels).toContain(k);
    const bot = read("src/components/feedback/FeedbackBot.jsx");
    expect(bot).toContain("const docked = desktop && winW >= 1100;");
    expect(bot).toContain('width: docked ? 520 : "min(480px, 100vw)"');
    expect(bot).toContain('aria-modal={chat && !desktop ? "true" : undefined}');
    const de = read("src/components/feedback/DesktopEva.jsx");
    expect(de).toContain("useIsMobile(768)");
    expect(read("src/components/layout/Layout.jsx").match(/<DesktopEva \/>/g)?.length).toBe(2);
  });
});

describe("v316 · Eva settings saved on the server (eva_settings, approved)", () => {
  it("clean values, routes and sync", () => {
    expect(cleanEvaSettings({ deals: false, lang: "hi" })).toEqual({ deals: false, money: true, lang: "hi" });
    expect(cleanEvaSettings({ lang: "fr", money: "no" })).toEqual({ deals: true, money: true, lang: "en" });
    const r = read("backend/assist_routes.ts");
    expect(r).toContain('router.get("/assist/settings"');
    expect(r).toContain('router.put("/assist/settings"');
    expect(read("scripts/sql/session58_eva_settings.sql")).toContain("create table if not exists public.eva_settings");
    expect(read("src/components/feedback/FeedbackBot.jsx")).toContain("await syncEvaSettings();");
    expect(read("src/components/feedback/EvaPanels.jsx")).toContain("saveEvaSettings(patch)");
  });
});

describe("v317 · Eva 👍 / 👎 saved (eva_feedback, approved)", () => {
  it("votes go into the table; admins see the ratings in Help desk → Chatbot", () => {
    const r = read("backend/assist_routes.ts");
    expect(r).toContain("await store.addFeedback(row)");
    expect(r).toContain('router.get("/admin/eva-feedback"');
    expect(r).toContain('user.role === "admin" || user.is_admin === true');
    expect(read("backend/assist_store.ts")).toContain('c.from("eva_feedback").insert(row)');
    expect(read("scripts/sql/session58_eva_feedback.sql")).toContain("public.eva_feedback");
    const inbox = read("src/components/admin/AdminFeedbackInbox.jsx");
    expect(inbox).toContain("<EvaRatings />");
    expect(inbox).toContain('api.get("admin/eva-feedback"');
  });
});

describe("v318 · Review & pay: pick a method, real amounts, no double messages", () => {
  it("the sheet lets the brand pick UPI / card / netbanking and Razorpay opens on it", () => {
    const sheet = read("src/components/chat/mobile/MobileEscrowSheet.jsx");
    for (const s of ['data-testid={`pay-method-${m.id}`}', 'role="radiogroup"', "await onPay?.(method)", "/pay-logos/${id}.svg", "Card details never reach Ybex."]) expect(sheet, s).toContain(s);
    const rz = read("src/lib/razorpay.js");
    expect(rz).toContain('["upi", "card", "netbanking", "wallet"].includes(method) ? { method } : {}');
    expect(rz).toContain('color: "#7C3AED"');
    expect(read("src/components/chat/mobile/useChatThreadMobile.js")).toContain("quiet: true");
  });
  it("server: one 'Payment Secured' message, no made-up ₹1,000 order, no fake prefill name", () => {
    const chat = read("backend/deals_chat_routes.ts");
    expect(chat).toContain(".select('message_id, message_type, metadata, created_at')");
    expect(chat).not.toContain(".select('id, message_type, metadata, created_at')");
    const pay = read("backend/payment_routes.ts");
    expect(pay).toContain('code: "AMOUNT_MISSING"');
    expect(pay).not.toContain("verifiedGrossAmount = 1000;");
    expect(pay).not.toContain('"Brand User"');
  });
  it("amounts shown = amounts charged", () => {
    expect(read("src/pages/collabs/DealDetail.jsx")).toContain("grossAmount={Number(deal.agreed_amount");
    expect(read("src/pages/brand/BrandUGCMobile.jsx")).not.toContain("(postData.budget * postData.max_creators).toLocaleString()");
    for (const f of ["src/components/payments/PayNow.jsx", "src/components/payments/BrandPaymentsMobile.jsx", "src/pages/brand/BrandUGCMobile.jsx", "src/pages/brand/BrandPayments.jsx"]) expect(read(f).toLowerCase(), f).not.toContain("secure secure");
  });
});

describe("v319 · bug hunt: wrong DB columns, money labels, fake numbers", () => {
  it("queries only use real columns", () => {
    expect(read("backend/feedback_routes.ts")).not.toContain("created_at,city,picture,photo");
    expect(read("backend/content_submissions_routes.ts")).toContain(".eq('collab_id', dealId)");
    const pay = read("backend/deals_chat_routes.ts");
    const ugcPart = pay.slice(pay.indexOf("Session 58 (bug hunt): chat_threads has no payment_funded"), pay.indexOf("Session 58 (bug hunt): chat_threads has no payment_funded") + 600);
    expect(ugcPart).not.toContain("payment_funded: true");
    const mi = read("backend/market_intelligence_routes.ts");
    expect(mi).toContain('.eq("deal_id", entityId)');
    expect(mi).toContain("creator_handle: verificationRecord.handle");
    expect(mi).not.toContain("recommended_content_formats: verificationRecord");
  });
  it("brand money screens: refunds found through deals, cancelled ≠ released, honest refund time, real payee", () => {
    expect(read("backend/campaignRefunds.ts")).toContain('.in("deal_id", dealIds)');
    expect(read("backend/brandPayments.ts")).toContain('"CANCELLED" ? "cancelled"');
    const m = read("src/components/payments/BrandPaymentsMobile.jsx");
    expect(m).not.toContain("within 30 hours");
    expect(m).toContain("showInvoiceModal.creator_name");
    expect(m).toContain('cancelled: { label: "Cancelled"');
  });
  it("creator money labels say 'Paid to bank' only with a UTR; phones use the full Earnings screen", () => {
    const u = read("src/pages/creator/CreatorUGCMobile.jsx");
    expect(u).toContain('order.realUtr ? "Paid to bank" : "Approved"');
    expect(u).not.toContain("Disbursed to bank");
    expect(read("src/pages/creator/CreatorUGCEarnings.jsx")).toContain('<Navigate to="/earnings" replace />');
    expect(read("backend/ugc_routes.ts")).toContain("await attachEarningsBriefs(withNet)");
    const card = read("src/components/chat/mobile/MobilePayoutCard.jsx");
    expect(card).not.toContain('"Download PDF"');
    expect(card).toContain("!isBrand && !utrNumber");
  });
  it("no invented numbers; whole-word niche filters; languages saved", () => {
    const home = read("src/pages/brand/BrandHomeMobile.jsx");
    expect(home).not.toContain("10k+");
    expect(home).not.toContain("|| 50000)");
    expect(home).toContain("Number(t.unread_count) > 0");
    expect(read("src/pages/brand/BrandCampaignCreate.jsx")).not.toMatch(/140\+|Payout Payout/);
    expect(langOf({ languages: ["Hindi", "English"] }, "Hindi")).toBe("Hindi, English");
    expect(langOf({}, "Hindi")).toBe("Hindi");
    const line = read("src/components/explore/mobile/ExploreMobile.jsx").split("\n").find((l) => l.startsWith("export const wordIn = ")) || "";
    // eslint-disable-next-line no-eval
    const wordIn = (0, eval)(line.replace("export const wordIn = ", ""));
    expect(wordIn("chai and hair care", "ai")).toBe(false);
    expect(wordIn("ai tools", "ai")).toBe(true);
    expect(wordIn("lifestyle vlogs", "style")).toBe(false);
  });
});

describe("v320 · launched drafts go to admin review (Ravi)", () => {
  it("submit-draft → under_review, with the same notice as a new campaign", () => {
    const r = read("backend/campaigns_routes.ts");
    const part = r.slice(r.indexOf('"/campaigns/:id/submit-draft"'), r.indexOf('"/campaigns/:id/submit-draft"') + 2600);
    expect(part).toContain("update({ status: 'under_review' })");
    expect(part).not.toContain("update({ status: 'live' })");
    expect(part).toContain('"CAMPAIGN_UNDER_REVIEW"');
    expect(read("src/pages/brand/BrandCampaigns.jsx")).toContain("Sent for review");
  });
});

describe("v321 · bug hunt round 3: accounts, KYC, admin money", () => {
  it("KYC never touches the email-verified flag; admin screens don't read it as KYC", () => {
    for (const f of ["backend/creators_routes.ts", "backend/brands_routes.ts", "backend/admin_kyc_verification_routes.ts"]) {
      expect(read(f), f).not.toContain("from('users').update({ verified: false })");
    }
    expect(read("src/components/admin/UserEnforcementPanel.jsx")).not.toContain("user.verified === true");
    expect(read("backend/admin_users_enforcement_routes.ts")).not.toContain("u.kyc_verified || u.verified ||");
  });
  it("account + login fixes", () => {
    const acc = read("backend/account_routes.ts");
    expect(acc).not.toContain("email_verified: true }");
    expect(acc).toContain("if (!saved) return res.status(502)");
    expect(read("src/pages/auth/Login.jsx")).toContain('errorCode === "EMAIL_NOT_VERIFIED"');
    const auth = read("backend/auth_routes.ts");
    expect(auth).toContain("password_hash: hashedPassword, verified: true");
    expect(auth).toContain("from('user_sessions').delete().eq('user_id', user.user_id)");
    expect(read("backend/oauth_routes.ts")).toContain("if (user.password_hash) patch.password_hash = null;");
    const cr = read("backend/creators_routes.ts");
    expect(cr).toContain("body.upiQrCodeUrl");
    expect(cr).toContain("body.ifsc");
    expect(cr).toContain('code: "KYC_SAVE_FAILED"');
    expect(cr).not.toContain("photo-1554415707");
  });
  it("admin money + honest numbers", () => {
    const e = read("src/components/admin/EscrowDashboard.jsx");
    expect(e).toContain("const isTxUnpaid");
    expect(e).toContain("paidTodayAmount={paidToday}");
    expect(e).not.toMatch(/29AAAAA0000A1Z5|9DEB885|65da8639/);
    expect(read("src/components/admin/AdminPayoutMobile.jsx")).toContain("t.bank_account_no ?");
    expect(read("src/components/admin/ReleasePayoutModal.jsx")).toContain("GST on fee:");
    expect(read("src/pages/admin/AdminHelpdesk.jsx")).not.toContain("~15m");
    expect(read("backend/referralProgram.ts")).toContain('!== "requested") return res.status(409)');
    expect(read("backend/admin_kyc_verification_routes.ts")).not.toMatch(/"2\+ Years"|"Fashion & Lifestyle"/);
    expect(read("backend/admin_waitlist_routes.ts")).toContain("delivered: Boolean(recipient)");
  });
});

describe("v322 · round 4: security, deal chat, UGC money, chat Warn / Restrict", () => {
  it("chat pause: latest restrict row blocks for 7 days, a lift ends it", () => {
    const now = Date.parse("2026-10-16T10:00:00Z");
    expect(chatBlockedUntil([{ violation_type: "CHAT_RESTRICTED", created_at: "2026-10-15T10:00:00Z" }], now)).toBe("2026-10-22T10:00:00.000Z");
    expect(chatBlockedUntil([{ violation_type: "CHAT_RESTRICTED", created_at: "2026-10-01T10:00:00Z" }], now)).toBe(null);
    expect(chatBlockedUntil([{ violation_type: "CHAT_RESTRICTED", created_at: "2026-10-15T10:00:00Z" }, { violation_type: "CHAT_UNRESTRICTED", created_at: "2026-10-15T12:00:00Z" }], now)).toBe(null);
    expect(chatBlockedUntil([{ violation_type: "Warning", created_at: "2026-10-15T10:00:00Z" }], now)).toBe(null);
    const r = read("backend/chat_routes.ts");
    expect(r).toContain('code: "CHAT_RESTRICTED"');
    expect(r).toContain('["issue_warning", "restrict_user", "unrestrict"].includes(action)');
    expect(read("src/components/admin/SystemReports.jsx")).toContain("Lift chat pause");
  });
  it("security holes closed", () => {
    expect(read("backend/campaign_lifecycle.ts").match(/code: "USE_UGC_ROUTE"/g)?.length).toBe(4);
    expect(read("backend/content_submissions_routes.ts")).toContain("brandOfSubmissionOk");
    expect(read("backend/server.ts")).toContain("quickAdminLocked");
    expect(read("backend/payment_routes.ts")).toContain('if (!user) return res.status(401).json({ error: "Please sign in." });');
  });
  it("deal chat: contract amount, typed words don't close a chat, team members, fee, offers", () => {
    expect(read("src/components/chat/ContractModal.jsx")).toContain("offer?.proposed_amount");
    expect(read("src/components/chat/dealState.js")).toContain("const isChatText");
    expect(read("backend/chat_routes.ts")).toContain(".neq('sender_user_id', user.user_id)");
    expect(read("backend/chat_routes.ts")).toContain("user.parent_brand_id || undefined");
    expect(read("src/components/chat/SystemMessage.jsx")).toContain("Number(metadata.platform_fee)");
    expect(read("src/components/chat/mobile/ChatBoxMobile.jsx")).toContain("meta.proposed_fee");
  });
  it("UGC money: briefs close only when every slot is delivered; no deadline reset; refunds and races", () => {
    expect(read("backend/services/ugcLifecycleService.ts")).toContain("isBriefFullyDelivered(doneCount, maxCreators)");
    expect(read("backend/services/ugcLifecycleService.ts")).toContain("const FEEDBACK_ONLY_ORDER_COLS = ['revision_notes'];");
    const u = read("backend/ugc_routes.ts");
    expect(u).toContain("target.agreement_signed_creator === true && target.internal_deadline");
    expect(u).toContain("q.eq('claimed_count', brief.claimed_count)");
    expect(u).toContain(".contains('refund_account_snapshot', { missing: true })");
    expect(u).toContain("ugc_routes:submit-fresh");
    expect(read("backend/services/ugcDeadlineService.ts")).toContain("if (slotClosed) await deps.releaseBriefSlot");
    expect(read("src/pages/brand/brandUgc/OrdersTab.jsx")).toContain("order.internal_deadline");
  });
});

describe("v323 · round 5: data leaks, public pages, Eva", () => {
  it("brand applications list is filtered to the brand's own campaigns", () => {
    const b = read("backend/browserDbRoutes.ts");
    expect(b).toMatch(/\.in\("campaign_id", ids\)/);
  });
  it("creator profile: own views not counted, deleted → 404, rates marked up like everywhere else", () => {
    const c = read("backend/creators_routes.ts");
    expect(c).toContain("isOwnView");
    expect(c).toContain("withMarkedRates");
  });
  it("public pages: no invented numbers or dates", () => {
    const card = read("src/components/campaigns/CampaignCard.jsx");
    expect(card).not.toContain("10000");
    expect(card).not.toContain("Jun 30, 2026");
    expect(read("src/pages/campaigns/CampaignDetail.jsx")).toContain("campaignClosed(");
    expect(read("src/pages/dashboard/InfoHub.jsx")).toContain("wa.me/918764004299");
    expect(read("src/pages/dashboard/Explore.jsx")).toContain("parseCreatorRate(a)");
  });
  it("Eva brand intents: bug reports, report, campaign, creators, applicants, budget words", () => {
    expect(detectBrandIntent("I want to report a bug")).toBe(null);
    expect(detectBrandIntent("my monthly report")?.intent).toBe("report");
    expect(detectBrandIntent("I want to create a campaign")?.intent).toBe("campaignCreate");
    expect(detectBrandIntent("find creators for my campaign")?.intent).toBe("creators");
    expect(detectBrandIntent("my campaign status")?.intent).toBe("status");
    expect(detectBrandIntent("who applied to my campaign")?.intent).toBe("applicants");
    expect(detectBrandIntent("what do you want to do")).toBe(null);
    expect(parseCreatorQuery("fashion creators budget of 10k").maxRate).toBe(10000);
    expect(parseCreatorQuery("creators less than 5000").maxRate).toBe(5000);
    expect(read("src/components/assist/brand/brain.js")).toContain('if (hit && kind.type === "feedback" && kind.category === "bug") hit = null;');
  });
  it("Eva creator intents: pan india, payments, deadlines, to-do", () => {
    expect(detectCreatorIntent("pan india campaigns")?.intent).toBe("campaigns");
    expect(detectCreatorIntent("pan card kaise add")?.intent).toBe("kyc");
    expect(detectCreatorIntent("payment pending")?.intent).toBe("earnings");
    expect(detectCreatorIntent("my deadlines")?.intent).toBe("due");
  });
  it("Eva never orders brands' results by creator rate, no 'best value'", () => {
    const list = [{ id: 1, rate_reel: 900, avg_reach: 10 }, { id: 2, rate_reel: 100, avg_reach: 20 }];
    expect(refineCreators(list, { ...parseCreatorQuery(""), sort: "rate" }).map((c: any) => c.id)).toEqual([1, 2]);
    expect(read("src/components/assist/brand/AssistCards.jsx")).not.toContain("Best value");
  });
  it("'new chat' keeps the old chat; stale replies dropped; seen only when shown", () => {
    expect(NEW_CHAT.test("new chat")).toBe(true);
    expect(CLEAR_CHAT.test("new chat")).toBe(false);
    expect(CLEAR_CHAT.test("clear chat")).toBe(true);
    const f = read("src/components/feedback/FeedbackBot.jsx");
    expect(f).toContain("if (startChat && chatIdRef.current !== startChat) return;");
    expect(f).toContain("if (r.newChat) { newChat();");
    expect(f).toContain("runOldBrain(t, id, true)");
    expect(read("src/components/assist/brand/tools.js")).toContain("seen: seenNow");
  });
  it("Eva: English fallback script, live-link stage, settings respected, backend caps", () => {
    expect(templateScript("Serum")).toContain("#ad");
    expect(templateScript("Serum")).not.toContain("maine");
    expect(read("src/components/assist/creator/creatorLogic.js")).toContain('"COMPLETED_APPROVAL", "AWAITING_LIVE_LINK"');
    expect(read("src/components/assist/brand/brain.js")).toContain("readEvaSettings().money ?");
    const r = read("backend/assist_routes.ts");
    expect(r).toContain("exportLimit.take(");
    expect(r).toContain("feedbackLimit.take(");
    expect(r).toContain("historyLimit.take(");
    expect(read("backend/assist_store.ts")).toContain("droppable.length >= SAVED_MAX");
  });
});

describe("v324 · round 6: accounts, money, campaigns, uploads", () => {
  it("brand profile no longer overwrites the login email / phone / role", () => {
    const b = read("backend/brands_routes.ts");
    expect(b).not.toContain("updatePayload.email = body.email");
    expect(b).not.toContain('updatePayload.role = "talent_manager"');
    expect(b).toContain("Only brand accounts can edit company details.");
  });
  it("account: delete checks real deal columns, password change ends other sessions, failures are reported", () => {
    const a = read("backend/account_routes.ts");
    expect(a).toContain("or(`creator_id.eq.${uid},brand_id.eq.${uid}`)");
    expect(a).toContain("heldDealIds(client, ids)");
    expect(a).toContain("await endOtherSessions(req, user.user_id);");
    expect(a).toContain("Couldn't delete your account right now.");
    expect(read("backend/session_routes.ts")).toContain("`sid:${sid}`");
    expect(read("backend/consents.ts")).toContain('from("email_unsubscribes")');
    expect(read("backend/auth_routes.ts")).toContain("await findUserByEmail(activeClient, email)");
  });
  it("money: frozen escrow, KYC before payout, referral races, invite KYC", () => {
    const p = read("backend/payment_routes.ts");
    expect(p).toContain('code: "ESCROW_FROZEN"');
    expect(p).toContain('code: "KYC_REQUIRED"');
    expect(p).toContain('code: "TX_CHANGED" }); // Session 58');
    expect(read("backend/creatorPayoutRequests.ts")).toContain('code: "KYC_REQUIRED"');
    expect(read("backend/referralProgram.ts")).toContain("WITHDRAWAL_CHANGED");
    expect(kycApproved({}, { status: "APPROVED" })).toBe(true);
    expect(kycApproved({}, { status: "PENDING" })).toBe(false);
    expect(read("src/components/admin/ReleasePayoutModal.jsx")).not.toContain("Verified KYC");
  });
  it("receipts never invent a fee", () => {
    for (const f of ["src/components/payments/InvoiceModal.jsx", "src/utils/invoicePdf.js"]) {
      const t = read(f);
      expect(t).not.toContain("* 15) / 100");
      expect(t).not.toContain(": 10;");
    }
  });
  it("campaigns: apply only to live, open campaigns; closed can't be edited; reason saved; no double accept", () => {
    expect(applyOpenReason({ status: "under_review" })).toBeTruthy();
    expect(applyOpenReason({ status: "live", deadline: "2020-01-01" })).toBeTruthy();
    expect(applyOpenReason({ status: "live", deadline: new Date(Date.now() + 864e5).toISOString() })).toBe(null);
    expect(countMatchingCreators({ categories: ["Fashion & Style"] }, [{ category: "Fashion" }, { category: "Tech" }, { category: "Fashion", is_deleted: true }])).toBe(1);
    const r = read("backend/campaigns_routes.ts");
    expect(r).toContain('code: "CAMPAIGN_CLOSED"');
    expect(r).toContain("rejection_reason: String(req.body?.reason");
    expect(r).toContain('code: "ALREADY_ACCEPTED"');
    expect(read("src/pages/brand/BrandCampaignCreate.jsx")).toContain('if (editId) { navigate("/brand/campaigns"); return; }');
    expect(read("src/pages/collabs/Collabs.jsx")).toContain('it.id, "reject")');
  });
  it("uploads: sign-in first, private files not cached, safe file extensions", () => {
    const m = read("backend/misc_routes.ts");
    expect(m).toContain('router.post("/upload", uploadGate, upload.single("file")');
    expect(m).toContain("'private, no-store'");
    expect(safeExt({ name: "video 2026 (1)", type: "video/mp4" })).toBe("mp4");
    expect(safeExt({ name: "clip.MOV" })).toBe("mov");
  });
  it("dashboards: live links only when submitted, no invented campaign values", () => {
    expect(computeAlerts({ orders: [{ status: "COMPLETED", live_link: "x" }] }).map((i: any) => i.key)).not.toContain("live");
    const mini = read("src/components/campaigns/CampaignMiniList.jsx");
    expect(mini).not.toContain("c.budget_min || 15000");
    expect(mini).not.toContain('"Jun 30, 2026"');
    expect(read("backend/creators_routes.ts")).not.toContain("performance_score: 75");
  });
});

describe("v325 · round 7: admin, notifications, UGC, public", () => {
  it("admin gate ignores URL case; feedback needs helpdesk permission", () => {
    expect(requiredAdminPermission("POST", "/Admin/users/x/ban")).toBe(requiredAdminPermission("POST", "/admin/users/x/ban"));
    expect(requiredAdminPermission("POST", "/ADMIN/users/x/ban")).not.toBe(null);
    expect(requiredAdminPermission("GET", "/admin/feedback")).toBe("manage_helpdesk");
    expect(read("backend/admin_users_enforcement_routes.ts")).not.toContain('select("user_id,role,team_role,is_admin")');
  });
  it("KYC / admin edits never touch users.verified (email); staff can't act on admins", () => {
    expect(read("backend/admin_logs_creators_routes.ts")).not.toContain("userUpdatePayload.verified = verified");
    expect(read("backend/admin_logs_creators_routes.ts")).not.toContain("client.from('users').update({ verified: isApproved })");
    expect(read("backend/admin_kyc_verification_routes.ts")).not.toContain("from('users').update({ verified: true })");
    expect(read("backend/admin_campaigns_settings_routes.ts").match(/staffTargetBlock\(/g)?.length).toBe(2);
    expect(read("backend/server.ts")).toContain("email: user?.email || null,");
  });
  it("notifications: per-admin / per-user rows, logout releases push, opt-outs, claimed email rows", () => {
    expect(read("backend/notificationService.ts")).not.toContain("{ ...payload, user_id: 'admin' }");
    expect(read("backend/notificationService.ts")).not.toContain('from("users").insert(userToInsert)');
    expect(read("backend/notifyFanout.ts")).toContain("one row per user");
    expect(read("src/contexts/AuthContext.jsx")).toContain("await releasePushOnLogout();");
    expect(read("backend/push_routes.ts")).toContain("promoOptOuts()");
    expect(read("backend/emailBroadcasts.ts")).toContain("claimRecipient(r)");
    expect(read("backend/services/ugcDeadlineService.ts")).toContain("emailEvenAtNight: true");
  });
  it("UGC: live link only after draft approval, link corrections limited, payments page, no name filter", () => {
    const u = read("backend/ugc_routes.ts");
    expect(u).toContain("'DRAFT_NOT_APPROVED'");
    expect(u).toContain("'DRAFT_ALREADY_APPROVED', hasLiveLinkEvidence");
    expect(u).not.toContain('b.brand_name?.toLowerCase().includes("ravi")');
    expect(u).toContain('code: "IN_HOUSE_UNAVAILABLE"');
    expect(read("backend/services/ugcLifecycleService.ts")).toContain("action === 'REQUEST_REVISION' || action === 'REQUEST_LIVE_LINK_REVISION'");
    expect(read("src/pages/brand/BrandUGCPayments.jsx")).toContain("String(o.creator_id || \"—\")");
  });
  it("public: handle filter safe, deal reviews shown, reports need sign-in, honest review text", () => {
    expect(read("backend/creators_routes.ts")).toContain("/^@?[a-z0-9._]{1,30}$/i.test(String(targetUserId))");
    expect(read("backend/persistedLists.ts")).toContain('from("reviews")');
    expect(read("backend/misc_routes.ts")).toContain("Please sign in to send a report.");
    expect(read("backend/chat_routes.ts")).toContain("You can review once the collaboration is complete.");
    expect(read("src/pages/creator/CreatorPublicView.jsx")).not.toContain("Exceptional campaign deliverables!");
  });
});

describe("v326 · round 8: DB columns, payments, contracts, coupons, blog, routing", () => {
  it("profile reads go through the server; public-read SQL is ready", () => {
    expect(read("src/pages/brand/BrandSettings.jsx")).not.toContain("supabase.from('brand_profiles')");
    expect(read("src/pages/creator/CreatorSettings.jsx")).not.toContain("supabase.from('creator_profiles')");
    expect(read("backend/creators_routes.ts")).toContain('router.get("/creators/review-queue"');
    expect(read("scripts/sql/session58_close_public_reads.sql")).toContain('drop policy if exists "Public read-only creator_profiles"');
  });
  it("campaign targeting saved for real; no past deadlines", () => {
    const t = campaignTargeting({ gender: "Both", follower_min: 10000, follower_max: 50000, specific_locations: ["Jaipur"], max_creators: 5, collab_mode: "Paid" });
    expect(t.gender).toBe(null);
    expect(t.follower_min).toBe(10000);
    expect(t.locations).toEqual(["Jaipur"]);
    expect(read("backend/campaigns_routes.ts")).toContain('code: "DEADLINE_PASSED"');
    expect(read("src/pages/brand/BrandCampaignCreate.jsx")).not.toContain("Include clear product close-up");
  });
  it("suspension really blocks the account until the date", () => {
    expect(read("backend/server.ts")).toContain("Date.parse(u.suspended_until) > Date.now()) return null;");
    expect(read("backend/admin_users_enforcement_routes.ts")).toContain("update({ suspended_until: until })");
  });
  it("payments: one deposit per deal, retries, part refunds", () => {
    const p = read("backend/payment_routes.ts");
    expect(p).toContain("duplicatePayment: true");
    expect(p).toContain("String((insErr as any).code) === '23505'");
    expect(p).toContain("if (result.unconfirmed) return res.status(500)");
    expect(p).toContain('req.body.source === "ondismiss"');
    expect(isRefunded({ refund_status: "PROCESSED", gross_amount: 20000, refund_amount: 2000 })).toBe(false);
    expect(isRefunded({ refund_status: "PROCESSED", gross_amount: 20000, refund_amount: 20000 })).toBe(true);
    expect(netAfterPartialRefund({ refund_status: "PROCESSED", refund_amount: 2000 }, 18000)).toBe(16000);
    expect(read("backend/deals_chat_routes.ts")).toContain("already_funded: true");
  });
  it("contracts: no signing during a counter / at another amount; stale offers refused", () => {
    const d = read("backend/deals_chat_routes.ts");
    expect(d).toContain("'COUNTER_PENDING'");
    expect(d).toContain("'AMOUNT_CHANGED'");
    expect(d).toContain("'STALE_OFFER'");
    expect(read("backend/deals_routes.ts")).toContain('code: "SIGN_IN_CHAT"');
    expect(read("backend/content_submissions_routes.ts")).toContain('code: "NO_DRAFT_IN_REVIEW"');
  });
  it("coupons: minimum deal value at payment, auto-apply saved", () => {
    const c = { id: "c1", code: "X", type: "flat_discount", discount_amount: 200, auto_apply: true, status: "active", min_campaign_value: 1000 };
    expect(pickCreatorCoupon([c], [], "u1", Date.now(), 300)).toBe(null);
    expect(pickCreatorCoupon([c], [], "u1", Date.now(), 5000)?.id).toBe("c1");
    expect(read("backend/admin_versions_coupons_routes.ts")).toContain("auto_apply: couponRecord.auto_apply === true");
  });
  it("blog HTML is cleaned", () => {
    const out = sanitizeHtml('<p>Hi</p><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><script>bad()</script>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>Hi</p>");
  });
  it("routing: return to the page after login, redirects, safe updates", () => {
    expect(read("src/App.jsx")).toContain("function LoginRedirect()");
    expect(read("src/App.jsx")).toContain('path="/brand/ugc" element={<Navigate to="/brand/ugc/orders" replace />}');
    expect(read("vite.config.js")).toContain("registerType: 'prompt'");
    expect(read("src/components/campaigns/ApplicantCard.jsx")).not.toContain('"₹12,000"');
  });
});

// v327 — Ravi's answers to the permission questions (Q1–Q17).
describe("Session 58 v327: permission answers", () => {
  const src = (f: string) => read(f);
  it("Q1/Q3: brand sees totals only; payout notice uses the deal total", () => {
    const pay = src("backend/payment_routes.ts");
    expect(pay).toContain("const totalsOnly = (u: any, row: any)");
    expect(pay).toContain("gross_amount");
  });
  it("Q7/Q8: 30-day sessions, rate limit uses the last forwarded IP", () => {
    expect(SESSION_MS).toBe(30 * 24 * 3600 * 1000);
    expect(clientIpQ8({ headers: { "x-forwarded-for": "1.1.1.1, 9.9.9.9" } })).toBe("9.9.9.9");
  });
  it("Q9: CORS allows ybexapp.ai.studio", () => {
    expect(src("backend/server.ts")).toContain("ybexapp.ai.studio");
  });
  it("Q11: risk controls read from the live row and enforced", () => {
    const rc = riskControlsFromRow({ withdrawal_min_limit: "500", payout_freeze_all: true, min_campaign_budget: null, max_campaign_budget: 100000 });
    expect(rc).toEqual({ payoutFreezeAll: true, minWithdrawal: 500, minBudget: null, maxBudget: 100000 });
    expect(riskControlsFromRow(null).payoutFreezeAll).toBe(false);
    expect(campaignBudgetProblem(0, 0, { ...rc, minBudget: 5000 })).toBe(null); // barter never blocked
    expect(campaignBudgetProblem(2000, 3000, { ...rc, minBudget: 5000 })).toContain("at least");
    expect(campaignBudgetProblem(5000, 200000, rc)).toContain("can't be more");
    expect(campaignBudgetProblem(5000, 15000, rc)).toBe(null);
    expect(src("backend/creatorPayoutRequests.ts")).toContain("PAYOUTS_FROZEN");
    expect(src("backend/creatorPayoutRequests.ts")).toContain("BELOW_MIN_WITHDRAWAL");
    expect(src("backend/payment_routes.ts")).toContain("PAYOUTS_FROZEN");
    expect(src("backend/campaigns_routes.ts")).toContain("BUDGET_OUT_OF_RANGE");
    expect(src("src/components/admin/platformTools/FeesSettingsCard.jsx")).toContain("Freeze all payouts");
  });
  it("Q14: Do's / Don'ts / Hashtags are saved cleaned, and only when sent", () => {
    const t: any = campaignTargetingQ14({ dos: "Show product\n\n- Tag us", donts: "", hashtags: "#Ybex, launch ##new! ybex" });
    expect(t.dos).toBe("Show product\nTag us");
    expect(t.donts).toBe(null);
    expect(t.hashtags).toEqual(["#Ybex", "#launch", "#new", "#ybex"]);
    expect("dos" in campaignTargetingQ14({ title: "x" })).toBe(false);
    expect(src("src/pages/brand/BrandCampaignCreate.jsx")).toContain("dos: dosText");
    expect(src("src/components/campaigns/mobile/MobileCampaignCreate.jsx")).toContain("dos: dosText");
  });
  it("Q16: reminders spread over 48/72h briefs; 24h unchanged", () => {
    const H = 3600000;
    expect(reminderSpacing(24 * H)).toEqual({ firstMs: 6 * H, everyMs: 3 * H });
    expect(reminderSpacing(48 * H)).toEqual({ firstMs: 12 * H, everyMs: 6 * H });
    expect(reminderSpacing(72 * H)).toEqual({ firstMs: 18 * H, everyMs: 9 * H });
  });
  it("Q16: counter is answered only by the side that received it; pre-payment is not 'In production'", () => {
    const thread = { id: "t", brand_id: "b1", creator_id: "c1", flow_state: "NEGOTIATING_COUNTER", status: "NEGOTIATING" };
    const messages = [{ message_type: "negotiation_offer", sender_user_id: "c1" }];
    const base = { thread, isUgcOrder: false, isMySignatureSigned: false, isOtherPartySigned: false, messages };
    expect(stageQ16({ ...base, isBrand: true }).action?.key).toBe("respond_counter");
    expect(stageQ16({ ...base, isBrand: false }).action).toBe(null);
    const active = { id: "t2", brand_id: "b1", creator_id: "c1", status: "ACTIVE", flow_state: "" };
    expect(chipQ16(active, true).label).not.toBe("In production");
    const signed = { ...active, agreement_signed_brand: true, agreement_signed_creator: true, flow_state: "AGREEMENT_SIGNED" };
    expect(stageQ16({ thread: signed, isBrand: true, isUgcOrder: false, isMySignatureSigned: true, isOtherPartySigned: true, messages: [] }).key).toBe("awaiting_payment");
  });
  it("Q16: desktop attachments saved and shown; counter / accept go out live", () => {
    expect(src("backend/chat_routes.ts")).toContain("export function chatAttachmentPath");
    expect(src("src/components/chat/MessageBubble.jsx")).toContain("msgType === 'attachment'");
    const dc = src("backend/deals_chat_routes.ts");
    expect(dc).toContain('flow_state: "NEGOTIATING_COUNTER", status: "NEGOTIATING" }, threadId)');
    expect(dc).toContain('flow_state: "AI_AGREEMENT_READY", status: "NEGOTIATING" }, threadId)');
  });
  it("Q17: Google sign-in without a popup link finishes on /app/oauth", () => {
    expect(src("backend/auth_routes.ts")).toContain('window.location.replace("/app/oauth#token="');
    expect(src("src/pages/auth/Login.jsx")).toContain("window.location.assign(res.data.url)");
    expect(src("src/pages/app/AppOAuthDone.jsx")).toContain("ybex_oauth_role");
  });
});


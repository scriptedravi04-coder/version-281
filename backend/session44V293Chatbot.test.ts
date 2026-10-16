import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { detectArea, feedbackPriority, splitDevice, FEEDBACK_PAGE } from "./feedback_routes";

// v293 (Ravi): Ybex Assist reports live in Help desk → Chatbot, not in the Support list; smarter tagging.
describe("v293 · chatbot reports", () => {
  it("works out which part of the app a report is about", () => {
    expect(detectArea("withdraw is not working and money is stuck")).toBe("Payments");
    expect(detectArea("OTP does not come on login")).toBe("Login & account");
    expect(detectArea("please add dark mode")).toBe("App speed & look");
    expect(detectArea("campaign apply button")).toBe("Campaigns");
    expect(detectArea("hello")).toBe("");
  });

  it("bugs about money / login or a crash are urgent; ideas are low", () => {
    expect(feedbackPriority("bug", "app crashed", "")).toBe("HIGH");
    expect(feedbackPriority("bug", "button looks odd", "Payments")).toBe("HIGH");
    expect(feedbackPriority("bug", "button looks odd", "Explore")).toBe("MEDIUM");
    expect(feedbackPriority("feature", "add voice notes", "Chat & deals")).toBe("LOW");
    expect(feedbackPriority("confusing", "where is it", "")).toBe("MEDIUM");
  });

  it("splits the phone-details footer from the person's words", () => {
    expect(splitDevice("it crashed\n\n— Screen: home · OS: iOS 18.1 · Device: iPhone")).toEqual({ text: "it crashed", device: "Screen: home · OS: iOS 18.1 · Device: iPhone" });
    expect(splitDevice("plain")).toEqual({ text: "plain", device: "" });
  });

  it("bot tickets are kept out of the Help desk list, the user's own ticket list and the Help desk red dot", () => {
    expect(FEEDBACK_PAGE).toBe("/feedback-bot");
    const s = readFileSync("backend/support_routes.ts", "utf8");
    expect(s).toContain('import { FEEDBACK_PAGE } from "./feedback_routes";');
    expect((s.match(/page_context !== FEEDBACK_PAGE/g) || []).length).toBe(3);
    const m = readFileSync("backend/admin_system_maintenance_routes.ts", "utf8");
    expect(m).toContain(".eq('page_context', '/feedback-bot')");
  });

  it("admin list sends area, urgency, headline, phone details and per-kind open counts", () => {
    const s = readFileSync("backend/feedback_routes.ts", "utf8");
    for (const k of ["area,", "headline:", "device: first.device", "openCounts", 'req.query.status']) expect(s).toContain(k);
    expect(s).toContain("feedbackPriority(item.category, item.message, area)");
  });
});

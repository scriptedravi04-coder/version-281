import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { cleanFeedback, deviceLine, feedbackAllowed, FEEDBACK_CATEGORIES, FEEDBACK_PAGE } from "./feedback_routes";

// Session 43 (v287, Ravi): "Ybex Assist" feedback bot → Help desk tickets + Admin → Feedback.
describe("v287 · feedback bot server", () => {
  it("needs a message; unknown category → general; only http(s) / uploads attachments, max 4", () => {
    expect(cleanFeedback({ message: "  " }).error).toBeTruthy();
    expect(cleanFeedback({ message: "x", category: "hack" }).item.category).toBe("general");
    const it = cleanFeedback({ message: "x", category: "bug", attachments: ["javascript:alert(1)", "https://a/b.png", "/uploads/c.png", "https://1", "https://2", "https://3"] }).item;
    expect(it.attachments).toEqual(["https://a/b.png", "/uploads/c.png", "https://1", "https://2"]);
  });

  it("bug / suggestion / confusing / general are separate Help desk categories", () => {
    expect(FEEDBACK_CATEGORIES.bug).toBe("Feedback · Bug");
    expect(FEEDBACK_CATEGORIES.feature).toBe("Feedback · Suggestion");
    expect(FEEDBACK_PAGE).toBe("/feedback-bot");
  });

  it("device line the team sees; 30 messages / hour per person", () => {
    expect(deviceLine({ screen: "brand dashboard", os: "Android 14", device_model: "SM-S918B", app_version: "v287" }))
      .toBe("Screen: brand dashboard · OS: Android 14 · Device: SM-S918B · App: v287");
    for (let i = 0; i < 30; i++) expect(feedbackAllowed("u1", 5)).toBe(true);
    expect(feedbackAllowed("u1", 5)).toBe(false);
  });

  it("follow-ups only into the person's own feedback ticket; admin list is admin-only with user details", () => {
    const src = readFileSync("backend/feedback_routes.ts", "utf8");
    expect(src).toContain("data.user_id === user.user_id && data.page_context === FEEDBACK_PAGE");
    expect(src).toContain('if (!isAdmin(user)) return res.status(403)');
    // Session 58 (bug hunt): city / photo are not columns on users — the old select failed on the live DB and the
    // admin list lost every name / email / phone. Requirement unchanged (user details shown); the query is fixed.
    expect(src).toContain('select("user_id,name,email,phone,role,created_at,picture")');
    expect(readFileSync("backend/server.ts", "utf8")).toContain("setupFeedbackRoutes(router");
  });
});

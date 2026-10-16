import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// v293 (Ravi): Ybex Assist talks; Help desk has a separate Chatbot section.
const read = (p) => readFileSync(p, "utf8");

describe("v293 · Ybex Assist + Help desk → Chatbot", () => {
  it("the bot uses the brain and only saves real reports", () => {
    const s = read("src/components/feedback/FeedbackBot.jsx");
    expect(s).toContain('from "./assistBrain"');
    expect(s).toContain("let p = plan(t, brainRef.current)");
    expect(s).toContain("just chatting — nothing is saved");
    expect(s).toContain('data-testid="feedback-chip-caps"');
    expect(s).toContain("ticket_id: fresh ? null : ticketRef.current"); // a new kind of report = its own ticket
    expect(s).toContain('"v293"');
  });
  it("Help desk has two sections: Support tickets and Chatbot", () => {
    const a = read("src/pages/admin/Admin.jsx");
    expect(a).toContain('<AdminHelpdeskHub key="helpdesk" initial="tickets" />');
    expect(a).toContain("case 'feedback':");
    const h = read("src/components/admin/AdminHelpdeskHub.jsx");
    expect(h).toContain("Support tickets");
    expect(h).toContain("Chatbot");
  });
  it("Chatbot section: four boxes, area filter, reviewed tick", () => {
    const s = read("src/components/admin/AdminFeedbackInbox.jsx");
    for (const t of ["Suggestions", "Bugs", "Confusing", "Other", "Mark reviewed", "Reopen", "Every area", "Waiting", "Reviewed"]) expect(s).toContain(t);
    expect(s).toContain("/admin/support/tickets/${encodeURIComponent(it.ticket_id)}/status");
    expect(read("src/components/admin/AdminMoreMobile.jsx")).toContain("Chatbot (Ybex Eva)");
    expect(read("src/components/layout/Layout.jsx")).toContain("Chatbot (Ybex Eva)");
  });
});

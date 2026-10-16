import { describe, it, expect } from "vitest";
import { plan, chipPlan, budgetChipPlan, initialState } from "./assistBrain";
import { parseAmount, budgetPlan, knowledge } from "./assistKnowledge";

// v295 (Ravi): Ybex Assist answers questions about the app and plans a budget. Chat only — never saved.
describe("v295 · amounts", () => {
  it("reads ₹50,000 · 50k · 1.5 lakh · 2 lac · 50 hazar, and ignores plain small numbers", () => {
    expect(parseAmount("budget ₹50,000")).toBe(50000);
    expect(parseAmount("I have 50k")).toBe(50000);
    expect(parseAmount("1.5 lakh")).toBe(150000);
    expect(parseAmount("2 lac")).toBe(200000);
    expect(parseAmount("50 hazar")).toBe(50000);
    expect(parseAmount("I need 5 videos")).toBeNull();
    expect(parseAmount("rs 7500")).toBe(7500);
  });
});

describe("v295 · budget plan", () => {
  it("gives real counts from Ybex's own rate bands (nano 3–8k, micro 8–25k, macro 25–75k)", () => {
    const r = plan("mera budget 50k hai, kya ho jayega?");
    expect(r.send).toBeNull();
    expect(r.reply).toMatch(/₹50,000/);
    expect(r.reply).toMatch(/nano/);
    expect(r.reply).toMatch(/micro/);
    expect(r.reply).toMatch(/1 micro \+ 3 nano/);
    expect(r.reply).toMatch(/Market Rate Advisor/);
  });
  it("a small budget points to a UGC brief; the plan never says escrow", () => {
    expect(budgetPlan(2000, "en")).toMatch(/UGC brief/);
    for (const a of [2000, 15000, 50000, 400000]) expect(budgetPlan(a, "hi") + budgetPlan(a, "en")).not.toMatch(/escrow/i);
  });
  it("English question with an amount", () => {
    const r = plan("I have a budget of 1 lakh, what can I do?");
    expect(r.reply).toMatch(/₹1,00,000/);
    expect(r.send).toBeNull();
  });
  it("the Plan my budget chip waits for the amount, then a bare number is enough", () => {
    const c = budgetChipPlan();
    expect(c.next.awaiting).toBe("budget");
    const r = plan("30000", c.next);
    expect(r.reply).toMatch(/₹30,000/);
    expect(r.send).toBeNull();
    expect(r.next.awaiting).toBeNull();
  });
  it("budget asked without an amount → asks for it", () => {
    const r = plan("how should I plan my campaign budget?");
    expect(r.reply).toMatch(/Tell me your budget|budget bata do/);
  });
  it("something else while waiting for the budget asks once more, then stops waiting", () => {
    const c = budgetChipPlan();
    const a = plan("asdf qwer zxcv", c.next);
    expect(a.next.awaiting).toBeNull();
  });
});

describe("v295 · app questions are answered, chat only", () => {
  const ask = (q, st) => plan(q, st);
  it.each([
    ["how do I withdraw my money?", /bank\/UPI in 1–2 working days/],
    ["what documents are needed for kyc?", /PAN/],
    ["how does ybex work?", /secure payment hold/],
    ["how do campaigns work?", /Creators apply/],
    ["how does ugc work?", /Collaboration Reel/],
    ["what is the platform fee?", /breakup/],
    ["is my payment safe?", /not straight to the creator/],
    ["how do I sign the agreement?", /OTP/],
    ["how can creators apply without login?", /Fill the Form/],
    ["what can brands do on ybex?", /verified creators/],
    ["what can creators do on ybex?", /Refer & Earn/],
    ["paise kab milenge?", /1–2 working days/],
  ])("%s", (q, rx) => {
    const r = ask(q);
    expect(r.send, q).toBeNull();
    expect(r.reply, q).toMatch(rx);
    expect(r.reply, q).not.toMatch(/escrow/i);
  });
  it("answers in Hinglish when asked in Hinglish", () => {
    expect(plan("withdraw kaise karu?").reply).toMatch(/Payout: brand/);
  });
  it("real problems still go to the team", () => {
    expect(plan("withdraw is not working").send.category).toBe("bug");
    expect(plan("payout nahi aaya, paise nahi mile").send).not.toBeNull();
    expect(plan("please add a payout history page").send.category).toBe("feature");
    expect(plan("I don't understand the refer and earn page").send.category).toBe("confusing");
    expect(plan("where is the refer button").send.category).toBe("confusing");
  });
  it("describing a bug after the Report a bug chip is never treated as a question", () => {
    const c = chipPlan("bug");
    const r = plan("when I tap withdraw how it shows blank", c.next);
    expect(r.send.category).toBe("bug");
  });
  it("general creator-economy advice is still training mode, not an app answer", () => {
    for (const q of ["how can I get more brand deals?", "how much should I charge for a reel", "how to grow followers?"]) {
      const r = plan(q);
      expect(r.send, q).toBeNull();
      expect(r.reply, q).toMatch(/training mode|training/i);
    }
  });
  it("an answer does not forget an open report", () => {
    const a = plan("app crashed on explore");
    const b = plan("what is the platform fee?", a.next);
    expect(b.send).toBeNull();
    expect(b.next.ticketKind).toBe("bug");
    expect(b.next.awaiting).toBe("followup");
  });
  it("knowledge() ignores plain statements", () => {
    expect(knowledge("I love the new design a lot today")).toBeNull();
  });
});

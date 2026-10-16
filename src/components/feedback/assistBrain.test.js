import { describe, it, expect } from "vitest";
import { classify, plan, chipPlan, capsPlan, initialState, detectLang } from "./assistBrain";

// v293 (Ravi): Ybex Assist must talk, tell bug / idea / confusing apart, and not save small talk.
const talk = (lines) => {
  let st = initialState();
  return lines.map((l) => { const r = plan(l, st); st = r.next; return r; });
};

// Session 58 (Eva handoff hard rule 1): the name is "Ybex Eva" everywhere — requirement change.
describe("v293 · Ybex Assist brain", () => {
  it("small talk is answered and never sent to the team", () => {
    for (const hi of ["hi", "Hello", "hey bhai", "good morning", "नमस्ते"]) {
      const r = plan(hi);
      expect(r.send).toBeNull();
      expect(r.reply).toMatch(/Ybex Eva/);
    }
    expect(plan("thanks!").send).toBeNull();
    expect(plan("how are you").send).toBeNull();
    expect(plan("who are you").reply).toMatch(/Ybex Eva/);
  });

  it("\"what can you do\" explains the bot and asks what to build next; the answer is saved as an idea", () => {
    const [a, b] = talk(["what can you do?", "voice notes in chat would be good for me"]);
    expect(a.send).toBeNull();
    expect(a.reply).toMatch(/bug reports/);
    expect(a.reply).toMatch(/More features are coming/);
    expect(b.send.category).toBe("feature");
    expect(b.send.prefix).toBe("[Ybex Eva idea] ");
    expect(b.send.newTicket).toBe(true);
    expect(capsPlan().next.awaiting).toBe("botIdea");
  });

  it("tells a bug, a suggestion and a confusion apart", () => {
    expect(classify("app crashes when I pay").category).toBe("bug");
    expect(classify("the apply button is not working").category).toBe("bug");
    expect(classify("no money received").category).toBe("bug");
    expect(classify("I suggest adding dark mode").category).toBe("feature");
    expect(classify("please add voice notes").category).toBe("feature");
    expect(classify("how do I withdraw my money?").category).toBe("confusing");
    expect(classify("where is the refer button").category).toBe("confusing");
  });

  it("a report gets a kind-specific reply with one follow-up question", () => {
    expect(plan("app crashes when I pay").reply).toMatch(/bug/i);
    expect(plan("app crashes when I pay").reply).toMatch(/\?/);
    expect(plan("I suggest adding dark mode").reply).toMatch(/creators, brands, or both/);
    expect(plan("where is the refer button").reply).toMatch(/expect to happen/);
  });

  it("money bugs also point to Support", () => {
    expect(plan("payment failed and money was cut").reply).toMatch(/Support/);
  });

  it("answers after a report join the same ticket; a different kind starts a new one", () => {
    const [first, more, other] = talk(["app crashed on explore", "when I tapped a creator card", "also please add dark mode"]);
    expect(first.send).toMatchObject({ category: "bug", newTicket: true });
    expect(more.send).toMatchObject({ category: "bug", newTicket: false });
    expect(more.reply).toBe("Added to your report. Anything else on your mind?");
    expect(other.send).toMatchObject({ category: "feature", newTicket: true });
  });

  it("\"no\" / \"that's all\" ends politely without saving; \"no money received\" is still a bug", () => {
    const [r] = talk(["no"]);
    expect(r.send).toBeNull();
    expect(classify("no money received").type).toBe("feedback");
  });

  it("a quick-start chip waits for the answer and keeps the chosen kind", () => {
    const c = chipPlan("bug");
    expect(c.reply).toBe("Oh no — what happened, and on which screen?");
    const r = plan("apply button does nothing", c.next);
    expect(r.send).toMatchObject({ category: "bug", newTicket: true });
    const hi = plan("hi", c.next);
    expect(hi.next.awaiting).toBe("detail"); // small talk does not forget the question
  });

  it("an unclear short message is not saved; a longer one is saved as general", () => {
    expect(plan("ok").send).toBeNull();
    expect(plan("test").reply).toMatch(/bug, an idea, or something/);
    expect(plan("the colours on the home page feel a little heavy to me").send.category).toBe("general");
  });

  it("answers in Hinglish when the person writes Hinglish", () => {
    expect(detectLang("mujhe ek idea hai")).toBe("hi");
    expect(detectLang("hello there")).toBe("en");
    expect(plan("kya kar sakte ho").reply).toMatch(/Abhi main ye kar sakta hoon/);
    expect(plan("tum kaun ho").reply).toMatch(/Main Ybex Eva/);
    const r = plan("mujhe ek idea hai ki chat mein voice note add karo");
    expect(r.send.category).toBe("feature");
    expect(r.reply).toMatch(/idea/);
  });
});

// v294 (Ravi): questions the bot cannot really answer get the "training mode" reply and are never saved.
describe("v294 · training-mode answers + more small talk", () => {
  it("creator-economy advice, off-topic and \"when are you live\" → training mode, not saved", () => {
    for (const q of ["how can I get more brand deals?", "how much should I charge for a reel", "best time to post on instagram?", "tell me a joke", "when will you go live?", "which AI are you? chatgpt?"]) {
      const r = plan(q);
      expect(r.send, q).toBeNull();
      expect(r.reply, q).toMatch(/training mode/i);
    }
  });
  it("answers in Hinglish and does not repeat the same words every time", () => {
    const [a, b, c] = talk(["instagram followers kaise badhau?", "brand deal ka rate kitna rakhu?", "aur tips do"]);
    expect(a.send).toBeNull();
    expect(a.reply).toMatch(/training mode/);
    expect(a.reply).toMatch(/kuch din mein live/);
    expect(new Set([a.reply, b.reply, c.reply]).size).toBe(3);
  });
  it("a real bug still goes to the team (v295: app questions are now answered — see assistKnowledge tests)", () => {
    expect(plan("instagram link is not showing on my profile").send.category).toBe("bug");
    expect(plan("withdraw is not working, money stuck").send.category).toBe("bug");
    expect(plan("please add a reels analytics page").send.category).toBe("feature");
  });
  it("a training answer does not forget the open question or report", () => {
    const c = chipPlan("bug");
    const r = plan("how to grow followers?", c.next);
    expect(r.send).toBeNull();
    expect(r.next.awaiting).toBe("detail");
    const [, , t] = talk(["app crashed on explore", "when I tapped a card", "how can I get more brand deals?"]);
    expect(t.send).toBeNull();
    expect(t.next.ticketKind).toBe("bug");
  });
  it("is honest that it is an automated helper, and points to Support for a person", () => {
    expect(plan("are you a human?").reply).toMatch(/not a person/);
    const h = plan("I want to talk to a real person");
    expect(h.send).toBeNull();
    expect(h.reply).toMatch(/Support/);
  });
  it("ok / sorry / praise / language are chat only", () => {
    for (const m of ["okay", "sorry", "you are doing a good job", "can you speak hindi?"]) expect(plan(m).send, m).toBeNull();
    expect(plan("ok").reply).toMatch(/bug|idea/);
  });
});

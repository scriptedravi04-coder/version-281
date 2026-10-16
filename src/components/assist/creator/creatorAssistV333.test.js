import { describe, it, expect } from "vitest";
import { detectCreatorIntent } from "./creatorLogic";
import { splitSections } from "./CreatorCards";

describe("Eva v333 (Ravi's phone test)", () => {
  it("'create a good profile for me' is a profile question, not campaigns", () => {
    expect(detectCreatorIntent("Can You create Good profile For Me")?.intent).toBe("profile");
    expect(detectCreatorIntent("meri profile achhi banao")?.intent).toBe("profile");
    expect(detectCreatorIntent("show campaigns for me")?.intent).toBe("campaigns");
  });
  it("'scrip' typo still asks for a script", () => {
    expect(detectCreatorIntent("Mere Liye Scrip Likho")?.intent).toBe("script");
  });
  it("a script is split into HOOKS / SCRIPT / CAPTION", () => {
    const p = splitSections("HOOKS\n1. a\n2. b\n\nSCRIPT (30s)\n0–3s: hi\n\nCAPTION\nNice #ad");
    expect(p.map((x) => x.title)).toEqual(["HOOKS", "SCRIPT (30S)", "CAPTION"]);
  });
});

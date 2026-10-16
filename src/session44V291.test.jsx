import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("v291 app", () => {
  it("bot: design gradient + grain, no waves/glow, keyboard box, anti-freeze", () => {
    const s = readFileSync("src/components/feedback/FeedbackBot.jsx", "utf8");
    expect(s).not.toContain("ambient glow");
    expect(s).toContain("useVisibleBox");
    expect(s).toContain("openTok");
    expect(s).toContain("clip-path .62s cubic-bezier(.65,0,.35,1)");
    expect(s).toContain("backgroundImage: GRAIN");
  });
  it("onboarding has one Log Out, signup needs a password, settings can set one", () => {
    expect(readFileSync("src/pages/auth/Onboarding.jsx", "utf8")).not.toContain("fixed bottom-4 left-4");
    expect(readFileSync("src/pages/app/AppContinue.jsx", "utf8")).toContain("const ownPassword = true;");
    expect(readFileSync("src/components/account/AccountPanel.jsx", "utf8")).toContain("account/password/set");
  });
  it("iPhone Google gets a login hint; creator home says Meet our top creators", () => {
    expect(readFileSync("src/pages/app/AppContinue.jsx", "utf8")).toContain("ybex_last_email");
    expect(readFileSync("src/pages/creator/CreatorHomeMobile.jsx", "utf8")).toContain("Meet our top creators");
  });
});

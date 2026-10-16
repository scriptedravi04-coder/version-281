import { describe, it, expect } from "vitest";
import fs from "fs";
import { LEGAL } from "./legalContent";

describe("Terms version (session 36)", () => {
  it("frontend and backend versions match, and the change list is not empty", () => {
    const be = fs.readFileSync("backend/consents.ts", "utf8").match(/TERMS_VERSION = "([^"]+)"/)[1];
    expect(be).toBe(LEGAL.termsVersion);
    expect(LEGAL.termsVersion).toBe("1.4"); // v332 requirement change (Ravi): fee renamed "Convenience fee & TDS" (1.3 = v290 referral section)
    expect(LEGAL.termsChanges.length).toBeGreaterThan(0);
  });
  it("the re-accept gate is mounted for every page", () => {
    expect(fs.readFileSync("src/App.jsx", "utf8")).toContain("<TermsUpdateGate />");
  });
});

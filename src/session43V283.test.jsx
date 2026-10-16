// Session 43 (v283) — Ravi's phone review: offers default on, brand logos, status bar, social
// platforms, location search, profile checklist, quick actions, NEW badges, logo crop, KYC resubmit,
// earnings payout line, chat skeleton, Android splash.
import React from "react";
import fs from "fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BrandLogo from "./components/common/BrandLogo";
import LogoCropper from "./components/common/LogoCropper";
import { applyStatusBarColor } from "./components/layout/StatusBarSync";
import { isMobileScreen } from "./pages/creator/CreatorSettings";

const read = (p) => fs.readFileSync(p, "utf8");
afterEach(cleanup);

describe("offers and promotions", () => {
  it("are on when no choice was saved; Terms say so and moved to v1.2", () => {
    const panel = read("src/components/legal/LegalPanel.jsx");
    expect(panel).toContain("consents?.marketing ? Boolean(consents.marketing.granted) : true");
    const legal = read("src/lib/legal/legalContent.js");
    expect(legal).not.toContain("only if you switch them on");
    // v290 (Ravi): referral & invite rewards section → Terms 1.3 (offers on by default still holds)
    expect(legal).toContain('termsVersion: "1.4"'); // v332 requirement change: Terms bumped (was 1.3)
    expect(read("backend/consents.ts")).toContain('TERMS_VERSION = "1.4"'); // v332 requirement change
  });
});

describe("brand logos", () => {
  it("fill the tile and fall back to the letter", () => {
    render(<BrandLogo src="https://x.supabase.co/l.png" name="Palmons" testId="a" />);
    expect(screen.getByTestId("a").className).toContain("object-cover");
    cleanup();
    render(<BrandLogo logo="https://api.dicebear.com/x" name="Palmons" testId="b" />);
    expect(screen.getByTestId("b").textContent).toBe("P");
    expect(read("src/components/campaigns/mobile/CampaignDetailMobile.jsx")).toContain("<BrandLogo name={c?.brand_name} logo={c?.brand_logo}");
  });
  it("logo upload goes through the cropper in onboarding (mobile + desktop) and the brand profile", () => {
    for (const f of ["src/pages/onboarding/BrandOnboardingMobile.jsx", "src/components/Onboarding/BrandOnboardingFlow.jsx", "src/components/profile/mobile/brand/CompanyDetailsScreen.jsx"]) {
      expect(read(f)).toContain("<LogoCropper file={cropFile}");
    }
  });
  it("cropper offers crop, use-as-is and cancel", () => {
    const onDone = vi.fn(), onCancel = vi.fn();
    const file = new File(["x"], "shot.png", { type: "image/png" });
    globalThis.URL.createObjectURL = globalThis.URL.createObjectURL || (() => "blob:x");
    globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {});
    render(<LogoCropper file={file} onDone={onDone} onCancel={onCancel} />);
    expect(screen.getByTestId("logo-cropper")).toBeTruthy();
    fireEvent.click(screen.getByText("Use as is"));
    expect(onDone).toHaveBeenCalledWith(file);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("status bar", () => {
  it("paints body as well as html (iOS 26 reads the body)", () => {
    applyStatusBarColor("#ffffff");
    expect(document.body.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(document.documentElement.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });
});

describe("social platforms", () => {
  it("platform add screens are valid screens (no bounce back to the hub)", () => {
    expect(isMobileScreen("platform_instagram")).toBe(true);
    expect(isMobileScreen("platform_youtube")).toBe(true);
    expect(isMobileScreen("platforms")).toBe(true);
    expect(isMobileScreen("platform_evil")).toBe(false);
  });
  it("reads and saves the real profile fields; YouTube asks subscribers + views", () => {
    const m = read("src/pages/creator/CreatorMobileProfile.jsx");
    expect(m).not.toContain("profile?.socialLinks");
    expect(m).toContain("payload.youtubeSubscribers");
    expect(m).toContain('data-testid={`yt-${key}`}');
    expect(m).toContain("<LocationAutocomplete");
    const st = read("src/pages/creator/CreatorSettings.jsx");
    expect(st).toContain("youtube_subscribers: Number(mergedProfile.youtubeSubscribers)");
  });
});

describe("creator home", () => {
  it("Finish shows what is pending; quick actions in Ravi's order", () => {
    const h = read("src/pages/creator/CreatorHomeMobile.jsx");
    expect(h).toContain('data-testid="profile-pending-sheet"');
    expect(h).toContain("setPendingOpen(true)");
    const order = ["My orders", "Refer & Earn", "Earnings", "Media kit"].map((t) => h.indexOf(`\n            ${t}\n`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("NEW sits on every 24h delivery chip", () => {
    expect(read("src/pages/creator/CreatorUGCMobile.jsx")).toContain("const isNew = true;");
    expect(read("src/pages/creator/CreatorUGCBrowse.jsx")).toContain('data-testid="ugc-new-badge"');
    expect(read("src/pages/brand/BrandUGCMobile.jsx")).toContain('data-testid="ugc-new-badge"');
  });
});

describe("KYC, earnings, chat, Android", () => {
  it("approved KYC can be resubmitted from the header", () => {
    expect(read("src/pages/creator/CreatorMobileProfile.jsx")).toContain('data-testid="kyc-resubmit"');
    expect(read("src/pages/brand/BrandKycMobile.jsx")).toContain('data-testid="brand-kyc-resubmit"');
  });
  it("earnings: payout destination is a small line in the total card", () => {
    const e = read("src/components/payments/CreatorEarningsMobile.jsx");
    expect(e).toContain('data-testid="earnings-payout-dest"');
    expect(e).not.toContain('">Payouts go to</div>');
  });
  it("chat waits for messages before the fallback card", () => {
    const c = read("src/components/chat/mobile/ChatBoxMobile.jsx");
    expect(c).toContain('data-testid="chat-skeleton"');
    expect(c).toContain("{messagesSettled && messages.length === 0 && !isUgcOrder && (");
    expect(c).toContain("setTimeout(() => setLoadWindowOver(true), 2500)");
  });
  it("Android launch shows the plain wordmark on purple", () => {
    expect(JSON.parse(read("twa-manifest.json")).iconUrl).toBe("/twa-splash-512.png");
    expect(fs.existsSync("public/twa-splash-512.png")).toBe(true);
  });
});

// Session 49 (Ravi): clean-up — big pages split into section files. Nothing else changed.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";

const read = (p) => readFileSync(p, "utf8");

const SPLITS = {
  "src/pages/creator/CreatorMobileProfile.jsx": [
    "profileScreens/PlatformsScreen", "profileScreens/HelpScreen", "profileScreens/RatesScreen",
    "profileScreens/PortfolioScreen", "profileScreens/SessionsScreen", "profileScreens/LegalScreen",
    "profileScreens/parts/LanguagesField", "profileScreens/parts/ContactVerificationSection",
    "profileScreens/parts/InstagramStatsForm", "profileScreens/parts/KycIdentitySection", "profileScreens/parts/KycPayoutSection",
  ],
  "src/pages/brand/BrandHomeMobile.jsx": [
    "brandHome/BrandHomeActions", "brandHome/ActiveBriefsCarousel", "brandHome/CampaignTemplatesRow",
    "brandHome/CampaignManagerCard", "brandHome/BrandsGrowingStrip", "brandHome/ScheduleCallModal",
  ],
  "src/pages/creator/CreatorHomeMobile.jsx": ["creatorHome/UgcLiveTimerCard"],
  "src/pages/creator/CreatorSettings.jsx": [
    "settingsDesktop/PlatformsPanel", "settingsDesktop/PastBrandsCard", "settingsDesktop/PortfolioList", "settingsDesktop/KycPanel",
  ],
  "src/components/admin/PlatformTools.jsx": [
    "platformTools/BroadcastEmailCard", "platformTools/MaintenanceCard", "platformTools/FeesSettingsCard",
    "platformTools/CouponList",
    // v303 (Session 53 launch audit): "platformTools/ReferralSettingsCard" is no longer shown — it overwrote
    // the live referral programme's settings. The file stays; the page just doesn't render it.
  ],
  "src/components/admin/UserEnforcementPanel.jsx": [
    "userEnforcement/BasicDetailsCard", "userEnforcement/KycHighlightsCard", "userEnforcement/PayoutHighlightsCard",
    "userEnforcement/ActivityTimelineCard", "userEnforcement/LegalKycGrid", "userEnforcement/UploadedDocumentsCard",
    "userEnforcement/PayoutMethodsCard", "userEnforcement/EscrowLedgerCard",
  ],
  // v300 (Ravi OK): the locked flow SCREENS too — only sections with no server call were moved, so the
  // protected manifest (backend/protectedFlows.test.ts) is unchanged.
  "src/components/chat/ChatBox.jsx": [
    "chatBox/ChatBoxComposer", "chatBox/ChatBoxDealStageLabel", "chatBox/ChatBoxDealStrip", "chatBox/ChatBoxFeedbackBox", "chatBox/ChatBoxFileUpload", "chatBox/ChatBoxHeader", "chatBox/ChatBoxMobileDock", "chatBox/ChatBoxModals", "chatBox/ChatBoxPaymentSheet", "chatBox/ChatBoxPresetChips", "chatBox/ChatBoxSignatureStatus", "chatBox/ChatBoxSubmissionRecord", "chatBox/ChatBoxUploadHeader", "chatBox/ChatBoxUploadSheet",
  ],
  "src/components/chat/SystemMessage.jsx": [
    "systemMessage/SysContractPendingCard", "systemMessage/SysContractSignedCard", "systemMessage/SysDraftApprovedCard", "systemMessage/SysGenericCard", "systemMessage/SysLiveLinksDeclinedBody", "systemMessage/SysPaymentFundedBrandCard", "systemMessage/SysPaymentFundedCreatorCard", "systemMessage/SysPayoutSettlementAlert",
  ],
  "src/components/campaigns/mobile/MobileCampaignCreate.jsx": [
    "campaignCreate/AdvancedTargetingForm", "campaignCreate/BriefFormContent", "campaignCreate/CitySheet", "campaignCreate/DatePickerSheet", "campaignCreate/KycShieldNotice", "campaignCreate/LanguageSheet", "campaignCreate/NicheSheet", "campaignCreate/PayoutPerCreator", "campaignCreate/PlatformsPicker", "campaignCreate/PublishedScreen", "campaignCreate/ReviewFeedCard", "campaignCreate/ReviewHeader",
  ],
  "src/pages/brand/BrandUGCMobile.jsx": [
    "brandUgc/AiPromptSheet", "brandUgc/ApprovedPayoutModal", "brandUgc/BriefStepFormat", "brandUgc/BriefStepProduct", "brandUgc/BriefStepTitle", "brandUgc/CreateFabMenu", "brandUgc/DeliverablePreviewCard", "brandUgc/OrdersTab", "brandUgc/RevisionModal", "brandUgc/UgcHomeHeader",
  ],
  "src/pages/creator/CreatorUGCMobile.jsx": [
    "creatorUgc/BriefDetailBody", "creatorUgc/BriefSpecsAccordion", "creatorUgc/BriefStickyBar", "creatorUgc/RevisionNoticeCard", "creatorUgc/SignWithOtpBox", "creatorUgc/SortSheet", "creatorUgc/SubmitDeliverableSection", "creatorUgc/UgcTopHeader",
  ],
  "src/pages/creator/ManageUGCOrdersView.jsx": [
    "manageUgc/BriefProductInfo", "manageUgc/DeclineRevisionsModal", "manageUgc/DropUploadBox", "manageUgc/RevisionAlertHeader", "manageUgc/StageCompleted", "manageUgc/StageInProgress", "manageUgc/StageInReview", "manageUgc/StageLiveLinkSubmitted",
  ],
  "src/pages/brand/BrandUGCOrders.jsx": [
    "brandUgcOrders/ApprovedCompletedPanel", "brandUgcOrders/AwaitingLiveLinkPanel", "brandUgcOrders/LiveLinkCard", "brandUgcOrders/OrderModalPanel", "brandUgcOrders/RevisionRequestedPanel",
  ],
};

describe("v299 · big pages are split into section files", () => {
  for (const [page, parts] of Object.entries(SPLITS)) {
    it(`${page} uses its section files`, () => {
      const dir = page.slice(0, page.lastIndexOf("/") + 1);
      const src = read(page);
      for (const p of parts) {
        expect(existsSync(`${dir}${p}.jsx`), p).toBe(true);
        expect(src, p).toContain(`from "./${p}"`);
        const name = p.split("/").pop();
        expect(src, p).toContain(`<${name} `);
        // a section file is layout only — except the contact section, which carries its two original
        // "save phone / e-mail" calls word for word (PATCH creators/me, same as before the move)
        if (name !== "ContactVerificationSection") expect(read(`${dir}${p}.jsx`), p).not.toMatch(/\bapi\.(get|post|put|patch|delete)\(/);
      }
    });
  }
  it("pages became much smaller", () => {
    const lines = (p) => read(p).split("\n").length;
    expect(lines("src/pages/creator/CreatorMobileProfile.jsx")).toBeLessThan(1800);
    expect(lines("src/pages/brand/BrandHomeMobile.jsx")).toBeLessThan(1600);
    expect(lines("src/components/admin/UserEnforcementPanel.jsx")).toBeLessThan(1200);
    expect(lines("src/components/chat/ChatBox.jsx")).toBeLessThan(2100);
    expect(lines("src/components/campaigns/mobile/MobileCampaignCreate.jsx")).toBeLessThan(1500);
  });
  it("old session summaries live in docs/sessions; a code map exists", () => {
    expect(existsSync("docs/sessions/archive/SESSION_47_SUMMARY.md")).toBe(true);
    expect(existsSync("docs/code/CODE_MAP.md")).toBe(true);
  });
});

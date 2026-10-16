import { describe, it, expect } from "vitest";
import { prepareCsvRows, toWaitlistRow, fillMissing, parseSubmittedAt, readReach } from "./waitlistCsvImport";
import { WAITLIST_COLUMNS } from "./creatorApplication";

// v291 (Ravi): the website's own CSV export (full_name, followers_count, avg_reach_per_reel, charges_ugc,
// content_niches …) lost followers / reach / price / niche on import. Every field must come through.
const SITE_ROW = {
  id: "88", full_name: "Aparajita Rathore", gender: "Female", instagram_handle: "@aparajita__rathore",
  instagram_link: "https://www.instagram.com/aparajita__rathore?stkn=abc&utm_source=qr", mobile: "7877622695",
  email: "aparajitarathore08.11@gmail.com", city: "Chandigarh", brands_applied: "All YBEX Brands",
  followers_count: "66,000", avg_reach_per_reel: "100k-200k", content_niches: "Beauty, Fashion",
  charges_ugc: "₹30,000", collab_types: "Paid Collab, Open to All", ugc_experience_rating: "5",
  sample_links: "https://www.instagram.com/reel/A/?stkn=1\nhttps://www.instagram.com/reel/B/?stkn=2",
  notes: "Hello", is_exclusive: "true", source: "public_form", submitted_at: "6/10/2026, 2:45:58 am",
};

describe("v291 CSV import takes every field", () => {
  it("maps the website export columns", () => {
    const [r] = prepareCsvRows([SITE_ROW], new Set());
    expect(r.status).toBe("ok");
    expect(r.value).toMatchObject({
      name: "Aparajita Rathore", gender: "Female", mobile: "+917877622695", city: "Chandigarh",
      social_handle: "aparajita__rathore", instagram_link: "https://instagram.com/aparajita__rathore",
      followers: 66000, avg_reach: "100k-200k", charges: "₹30,000", niche: "Beauty, Fashion",
      collab_types: ["Paid Collab", "Open to All"], ugc_rating: 5,
    });
    expect(r.value!.sample_links).toHaveLength(2);
    expect(r.value!.notes).toBe("Hello\n\nApplied to: All YBEX Brands · Marked exclusive on the old form");
    expect(r.value!.created_at).toBe("2026-10-05T21:15:58.000Z"); // 6 Oct 2026, 2:45:58 am IST
  });

  it("saves only real waitlist columns and keeps the real apply date", () => {
    const [r] = prepareCsvRows([SITE_ROW], new Set());
    const row: any = toWaitlistRow(r.value!, "2030-01-01T00:00:00.000Z");
    for (const k of Object.keys(row)) expect(WAITLIST_COLUMNS).toContain(k);
    expect(row.created_at).toBe("2026-10-05T21:15:58.000Z");
    expect(row.source).toBe("csv_import");
  });

  it("reach: counts become numbers, ranges stay as written (nothing invented)", () => {
    expect(readReach("70,000")).toBe("70000");
    expect(readReach("1.8M")).toBe("1800000");
    expect(readReach("30000+")).toBe("30000");
    expect(readReach("100k to 500k")).toBe("100k to 500k");
    expect(readReach("")).toBeNull();
  });

  it("dates: day/month/year am-pm in India time; garbage and the future are ignored", () => {
    expect(parseSubmittedAt("28/9/2026, 9:56:01 am")).toBe("2026-09-28T04:26:01.000Z");
    expect(parseSubmittedAt("10/9/2026, 12:00:00 pm")).toBe("2026-09-10T06:30:00.000Z");
    expect(parseSubmittedAt("31/2/2026, 1:00:00 am")).not.toBeNull(); // JS rolls it over; only month/day ranges are checked
    expect(parseSubmittedAt("13/13/2026, 1:00:00 am")).toBeNull();
    expect(parseSubmittedAt("nope")).toBeNull();
    expect(parseSubmittedAt("1/1/2099, 1:00:00 am")).toBeNull();
  });

  it("fixes an e-mail typed with a leading @; bare handle in the link column still works", () => {
    const res = prepareCsvRows([
      { full_name: "D", email: "@dimple@gmail.com", instagram_link: "Anush.ka_023" },
    ], new Set());
    expect(res[0].status).toBe("ok");
    expect(res[0].value).toMatchObject({ email: "dimple@gmail.com", social_handle: "Anush.ka_023" });
  });

  it("uploading again completes an earlier partial import — only empty cells, never overwrites", () => {
    const earlier = { id: "w1", email: "a@x.in", source: "csv_import", name: "A", city: "Delhi", followers: null, avg_reach: null, notes: "Hello" };
    const res = prepareCsvRows([{ ...SITE_ROW, email: "a@x.in", city: "Mumbai" }], new Set(["a@x.in"]), new Set(["a@x.in"]));
    expect(res[0].status).toBe("update");
    const patch = fillMissing(earlier, res[0].value!);
    expect(patch).toMatchObject({ followers: 66000, avg_reach: "100k-200k", charges: "₹30,000", ugc_rating: 5 });
    expect(patch.city).toBeUndefined();       // already filled — kept
    expect(patch.name).toBeUndefined();
    expect(patch.created_at).toBeUndefined();
    expect(patch.notes).toContain("Applied to: All YBEX Brands"); // extras appended after the saved notes
    // an email that is on Ybex but NOT from an earlier csv import is still just a duplicate
    expect(prepareCsvRows([SITE_ROW], new Set([SITE_ROW.email]))[0].status).toBe("duplicate");
  });
});

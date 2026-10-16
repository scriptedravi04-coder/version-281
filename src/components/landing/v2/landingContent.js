import { api } from "../../../lib/api";

// v333 (Ravi: "logos and reviews admin ki platform settings se upload hote hai"): the landing page reads the same
// admin content as before — Admin → Landing content → brand logos (/landing-brands) and reviews (/landing-reviews).
// No admin reviews → the reviews section is hidden (the design's sample quotes are never shown as real ones).
const clean = (v) => String(v || "").trim();

export function toDesignReview(r) {
  const parts = clean(r.author_role).split(" • ");
  return {
    type: r.type === "brand" ? "brand" : "creator",
    name: clean(r.author_name) || (r.type === "brand" ? "Brand" : "Creator"),
    handle: parts[0] || clean(r.category),
    role: parts.length > 1 ? parts.slice(1).join(" • ") : clean(r.category),
    photo: clean(r.author_image) && !/ui-avatars|dicebear/.test(r.author_image) ? r.author_image : "",
    quote: clean(r.content),
    proof: clean(r.highlight_text),
  };
}

export async function loadLandingContent() {
  const [logos, reviews] = await Promise.all([
    api.get("/landing-brands").then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    api.get("/landing-reviews").then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  ]);
  return {
    cmsLogos: logos.filter((b) => b && b.logo_url && b.is_active !== false),
    cmsReviews: reviews.filter((r) => r && clean(r.content) && r.is_active !== false).map(toDesignReview),
  };
}

// @vitest-environment node
// v295 (Ravi): will Google crawl and index the blog? These tests start the real SEO routes (backend/blogSeo.ts)
// with a fake database and a copy of the real index.html, and check what a crawler actually receives.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import { setupBlogSeoRoutes, injectMeta, postMeta, robotsTxt, sitemapXml, stripHtml, truncate } from "./blogSeo";

const POSTS = [
  { id: "1", slug: "how-to-price-a-reel", title: "How to price a reel in India", status: "published", excerpt: "A simple way to price Instagram reels.", content: "<h2>Start with reach</h2><p>Average reach per reel matters most.</p><script>alert(1)</script><p onclick=\"x()\">Safe text</p>", meta_title: "Reel pricing guide", meta_description: "Price your reels using average reach and niche benchmarks.", category: "Guides & Playbooks", tags: ["pricing", "__author_name:Ravi"], cover_image_url: "/img/cover.jpg", published_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-05T10:00:00Z" },
  { id: "2", slug: "second-post", title: "Second <b>post</b> & more", status: "published", excerpt: "", content: "<p>Body of the second post.</p>", published_at: "2026-10-02T10:00:00Z", updated_at: "2026-10-02T10:00:00Z", tags: [] },
  { id: "3", slug: "secret-draft", title: "Draft only", status: "draft", content: "<p>Not public</p>", tags: [] },
];
const fakeClient = (rows: any[], fail = false) => ({
  from: (_t: string) => {
    const filters: Array<[string, any]> = [];
    const q: any = {
      select: () => q, order: () => q, limit: () => q,
      eq: (k: string, v: any) => { filters.push([k, v]); return q; },
      maybeSingle: async () => (fail ? { data: null, error: { message: "down" } } : { data: rows.find((r) => filters.every(([k, v]) => r[k] === v)) || null, error: null }),
      then: (ok: any) => ok(fail ? { data: null, error: { message: "down" } } : { data: rows.filter((r) => filters.every(([k, v]) => r[k] === v)), error: null }),
    };
    return q;
  },
});
const SHELL = `<!doctype html><html><head><title>Ybex | Generic</title>
<meta name="description" content="generic" />
<meta property="og:title" content="generic" />
<meta property="og:url" content="https://old.example/" />
<meta property="og:image" content="https://old.example/og.jpg" />
<meta name="twitter:title" content="generic" />
</head><body><div id="root"></div></body></html>`;

let server: any, base = "", dir = "";
let failing = false;
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-"));
  fs.writeFileSync(path.join(dir, "index.html"), SHELL);
  const app = express();
  setupBlogSeoRoutes(app, { getClient: () => (failing ? fakeClient([], true) : fakeClient(POSTS)), distPath: dir });
  app.get("*", (_req, res) => res.send("spa"));
  await new Promise<void>((r) => { server = app.listen(0, "127.0.0.1", () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

describe("v295 · a published article gets its own SEO tags", () => {
  it("title, description, canonical, Open Graph, Twitter and JSON-LD are in the HTML itself (no JavaScript needed)", async () => {
    const r = await fetch(`${base}/blog/how-to-price-a-reel`);
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain("<title>Reel pricing guide — YBEX</title>");
    expect(html).toContain('<meta name="description" content="Price your reels using average reach and niche benchmarks." />');
    expect(html).toContain(`<link rel="canonical" href="${base}/blog/how-to-price-a-reel" />`);
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain(`<meta property="og:image" content="${base}/img/cover.jpg" />`);
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large" />');
    expect(html).not.toContain("old.example");              // the generic tags are replaced, not duplicated
    expect(html.match(/<meta name="description"/g)?.length).toBe(1);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    expect(ld.length).toBe(2);
    const article = JSON.parse(ld[0].replace(/<\/?script[^>]*>/g, ""));
    expect(article["@type"]).toBe("BlogPosting");
    expect(article.author.name).toBe("Ravi");
    expect(article.datePublished).toBe("2026-10-01T10:00:00.000Z");
  });
  it("the article text is there for crawlers without JavaScript, with scripts and inline handlers removed", async () => {
    const html = await (await fetch(`${base}/blog/how-to-price-a-reel`)).text();
    expect(html).toMatch(/<noscript><article><h1>How to price a reel in India<\/h1>/);
    expect(html).toContain("Average reach per reel matters most.");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("onclick");
  });
  it("a title with HTML characters cannot break the page", async () => {
    const html = await (await fetch(`${base}/blog/second-post`)).text();
    expect(html).toContain("<title>Second &lt;b&gt;post&lt;/b&gt; &amp; more — YBEX</title>");
    expect(html).not.toContain("<b>post</b> &");
  });
});

describe("v295 · missing and unpublished articles are real 404s, never drafts", () => {
  it("unknown slug → 404 + noindex", async () => {
    const r = await fetch(`${base}/blog/does-not-exist`);
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('content="noindex, nofollow"');
  });
  it("a draft is not served (404 + noindex) and its text never appears", async () => {
    const r = await fetch(`${base}/blog/secret-draft`);
    const html = await r.text();
    expect(r.status).toBe(404);
    expect(html).not.toContain("Not public");
  });
  it("database down → 503 (Google retries later) instead of telling it the article is gone", async () => {
    failing = true;
    const r = await fetch(`${base}/blog/how-to-price-a-reel`);
    failing = false;
    expect(r.status).toBe(503);
  });
});

describe("v295 · /blog, robots.txt and sitemap.xml", () => {
  it("/blog lists the published articles with links, never the draft", async () => {
    const html = await (await fetch(`${base}/blog`)).text();
    expect(html).toContain("<title>YBEX Journal — Creator Economy &amp; Influencer Marketing</title>");
    expect(html).toContain(`href="${base}/blog/how-to-price-a-reel"`);
    expect(html).not.toContain("secret-draft");
    expect(html).toContain('"@type":"Blog"');
  });
  it("robots.txt allows the blog, blocks the API and admin, and points to the sitemap", async () => {
    const t = await (await fetch(`${base}/robots.txt`)).text();
    expect(t).toContain("Allow: /");
    expect(t).toContain("Disallow: /api/");
    expect(t).toContain("Disallow: /admin");
    expect(t).toContain(`Sitemap: ${base}/sitemap.xml`);
  });
  it("sitemap.xml has the home page, /blog and every PUBLISHED article only", async () => {
    const r = await fetch(`${base}/sitemap.xml`);
    const x = await r.text();
    expect(r.headers.get("content-type")).toMatch(/xml/);
    expect(x).toContain(`<loc>${base}/</loc>`);
    expect(x).toContain(`<loc>${base}/blog</loc>`);
    expect(x).toContain(`<loc>${base}/blog/how-to-price-a-reel</loc>`);
    expect(x).toContain("<lastmod>2026-10-05</lastmod>");
    expect(x).not.toContain("secret-draft");
  });
  it("SEO_NOINDEX=1 (for a test site) blocks everything", () => {
    process.env.SEO_NOINDEX = "1";
    expect(robotsTxt("https://x.test")).toBe("User-agent: *\nDisallow: /\n");
    expect(injectMeta(SHELL, { title: "t", description: "d", canonical: "https://x.test/" })).toContain("noindex, nofollow");
    delete process.env.SEO_NOINDEX;
  });
});

describe("v295 · helpers", () => {
  it("stripHtml / truncate / postMeta fall back sensibly", () => {
    expect(stripHtml("<p>Hi&nbsp;<b>there</b></p><script>x()</script>")).toBe("Hi there");
    expect(truncate("a ".repeat(200), 50).length).toBeLessThanOrEqual(50);
    const m = postMeta({ slug: "s", title: "T", content: "<p>" + "word ".repeat(100) + "</p>", tags: [] }, "https://x.test");
    expect(m.description.length).toBeLessThanOrEqual(160);
    expect(m.image).toBe("https://x.test/og-image.jpg");
  });
  it("sitemapXml escapes addresses", () => {
    expect(sitemapXml("https://x.test", [{ slug: "a&b" }])).toContain("a&amp;b");
  });
});

// v337 — Cloudflare Worker: ybexmedia.in → ybexapp.ai.studio (free "jugad" until Ybex has its own server).
// Paste this whole file into the Worker editor (docs/setup/DOMAIN_CLOUDFLARE.md, step 5). Nothing else to change.
//
// What it does:
//  - every request to ybexmedia.in is sent to ybexapp.ai.studio (same path, method, body, cookies) and the answer comes
//    back as if ybexmedia.in sent it — the visitor never sees ai.studio;
//  - www.ybexmedia.in → ybexmedia.in (one address for Google);
//  - live chat (socket.io / websocket) passes straight through;
//  - redirects that point at ybexapp.ai.studio are rewritten to ybexmedia.in;
//  - sends the visitor's real IP + the secret PROXY_SHARED_SECRET, so the server's login limits see each person
//    separately (backend/domainProxy.ts). Set the SAME secret in the Worker and in the app's hosting secrets.

const TARGET_HOST = "ybexapp.ai.studio";
const MAIN_HOST = "ybexmedia.in";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www." + MAIN_HOST) {
      url.hostname = MAIN_HOST;
      return Response.redirect(url.toString(), 301);
    }

    const publicHost = url.host;
    url.protocol = "https:";
    url.hostname = TARGET_HOST;
    url.port = "";

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", publicHost);
    headers.set("x-forwarded-proto", "https");
    const ip = request.headers.get("cf-connecting-ip") || "";
    if (ip) headers.set("x-ybex-client-ip", ip);
    if (env && env.PROXY_SHARED_SECRET) headers.set("x-ybex-proxy-key", env.PROXY_SHARED_SECRET);

    const hasBody = !["GET", "HEAD"].includes(request.method);
    let res;
    try {
      res = await fetch(url.toString(), {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
      });
    } catch (e) {
      return new Response("Ybex is waking up — please try again in a moment.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "5" },
      });
    }

    // Live chat (websocket) — hand the open connection back untouched.
    if (res.status === 101) return res;

    const loc = res.headers.get("location");
    if (loc && loc.includes(TARGET_HOST)) {
      const h = new Headers(res.headers);
      h.set("location", loc.split("https://" + TARGET_HOST).join("https://" + publicHost));
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    return res;
  },
};

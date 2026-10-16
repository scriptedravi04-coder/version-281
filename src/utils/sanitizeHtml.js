// Session 58: clean HTML from the server before showing it with dangerouslySetInnerHTML (blog posts).
// Uses the browser's own parser: drops dangerous tags, every on* handler and javascript:/data: links.
const BAD_TAGS = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "FORM", "FRAME", "FRAMESET", "SVG", "MATH"];
export function sanitizeHtml(html) {
  const raw = String(html ?? "");
  if (typeof DOMParser === "undefined") return raw.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, "text/html");
  const root = doc.body.firstElementChild || doc.body;
  root.querySelectorAll("*").forEach((el) => {
    if (BAD_TAGS.includes(el.tagName.toUpperCase())) { el.remove(); return; }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = String(attr.value || "").replace(/[\s\u0000-\u001f]+/g, "").toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (["href", "src", "xlink:href", "action", "formaction", "srcset"].includes(name) && /^(javascript|vbscript|data):/.test(val) && !/^data:image\//.test(val)) el.removeAttribute(attr.name);
      else if (name === "style" && /expression\(|url\(\s*['"]?javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A" && el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
  });
  return root.innerHTML;
}

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Upload, Eye, MousePointerClick } from "lucide-react";
import { api } from "../../lib/api";

// Session 43 (v289, Ravi): Admin → Platform tools → Promo popups. Upload the designer's poster, pick a
// layout, where a tap goes, who sees it and how often. The whole poster is the button; users get a ✕.
const LAYOUTS = [
  { id: "fullscreen", label: "Full screen", hint: "Like Hopr's invite poster — the whole phone screen." },
  { id: "card", label: "Centre card", hint: "Like Hopr's \"New on Hopr\" — a rounded card, app dimmed behind." },
  { id: "sheet", label: "Bottom sheet", hint: "Like Swiggy — slides up from the bottom." },
  { id: "banner", label: "Profile banner", hint: "Like Swish — a strip under the photo on My Profile." },
];
const SIZES = {
  fullscreen: "1080 × 2340 px · keep text and faces inside the middle 1080 × 1920",
  card: "960 × 1400 px · keep 40 px clear on every side (rounded corners)",
  sheet: "1080 × 1200 px · keep the top 120 px clear (✕ and rounded top)",
  banner: "1080 × 200 px · keep text 40 px from the left / right edges",
};
const RATIO = { fullscreen: "1080 / 2340", card: "960 / 1400", sheet: "1080 / 1200", banner: "1080 / 200" };
const EMPTY = { title: "", layout: "fullscreen", image_url: "", link_url: "", audience: "all", frequency: "once", starts_at: "", ends_at: "", is_active: true /* Session 48: new promos start Live — "off" by default made uploads look late */, priority: 0 };
// v332: readable audience / frequency in the list (was raw "creator", "guest", "every open")
const AUD_LABEL = { all: "Everyone signed in", creator: "Creators", brand: "Brands", guest: "Not signed up yet" };
const FREQ_LABEL = { once: "Once per person", daily: "Once a day", every_open: "Every app open" };
const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const status = (p) => {
  const now = Date.now();
  if (!p.is_active) return ["Off", "#6B7280", "#F3F4F6"];
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return ["Scheduled", "#B45309", "#FEF3C7"];
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return ["Ended", "#6B7280", "#F3F4F6"];
  return ["Live", "#15803D", "#DCFCE7"];
};

export default function AdminPromoPopups() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false); // v332: "No promo popups yet." flashed before the list loaded
  const [rowBusy, setRowBusy] = useState(null); // v332: no double toggle / delete
  const fileRef = useRef(null);

  const load = async () => {
    setErr("");
    try { const { data } = await api.get("admin/promos", { bypassCache: true }); setItems(data?.items || []); }
    catch (e) { setErr(e?.response?.data?.error || "Could not load promo popups."); }
    finally { setLoaded(true); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("image_url", data?.public_url || data?.url || "");
    } catch { toast.error("Couldn't upload the poster. Please try again."); } // v332
    setUploading(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null };
      await api.post("admin/promos", body);
      toast.success(form.is_active ? "Saved — live for users" : "Saved (off)");
      setForm(null); load();
    } catch (e) { toast.error(e?.response?.data?.error || "Couldn't save. Please try again."); }
    setBusy(false);
  };
  const remove = async (p) => {
    if (rowBusy) return;
    if (!window.confirm(`Delete "${p.title || "this promo"}"?`)) return;
    setRowBusy(p.id);
    try { await api.delete(`admin/promos/${p.id}`); toast.success("Deleted."); load(); } catch { toast.error("Couldn't delete. Please try again."); } // v332: success toast
    finally { setRowBusy(null); }
  };
  const toggle = async (p) => {
    if (rowBusy) return; // v332
    setRowBusy(p.id);
    try { await api.post("admin/promos", { ...p, is_active: !p.is_active }); toast.success(p.is_active ? "Turned off." : "Turned on — live for users."); load(); } catch (e) { toast.error(e?.response?.data?.error || "Couldn't change it. Please try again."); }
    finally { setRowBusy(null); }
  };

  const input = "w-full h-11 px-3 rounded-xl border border-gray-200 text-[16px] sm:text-sm font-medium focus:outline-none focus:border-purple-500"; // v332: no iOS zoom
  return (
    <div className="mt-6" style={{ fontFamily: "'DM Sans', sans-serif" }} data-testid="admin-promos">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">Promo popups & profile banner</h3>
          <p className="text-sm text-gray-500">Shown once when the app opens on a phone. The whole poster is tappable; users get a ✕. One popup per app open.</p>
        </div>
        {!form && <button type="button" onClick={() => setForm({ ...EMPTY })} className="h-10 px-4 rounded-xl bg-purple-600 text-white text-sm font-bold flex items-center gap-2"><Plus size={16} /> New promo</button>}
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {/* Session 48 (Ravi: "explain this screen — what is priority?") */}
      <details className="mt-4 bg-purple-50/60 border border-purple-100 rounded-2xl p-4 text-[13px] text-gray-700" data-testid="promo-help">
        <summary className="font-bold text-purple-800 cursor-pointer">How this works (read once)</summary>
        <ol className="mt-2 space-y-1.5 list-decimal pl-5">
          <li><b>Layout</b> — where the poster shows: full screen, a centre card, a bottom sheet, or the thin <b>Profile banner</b> on My Profile. Use the designer size shown under it.</li>
          <li><b>Poster</b> — upload the image. The whole image is the button.</li>
          <li><b>Tap opens</b> — an app page like <code>/creator/refer</code>, or a full <code>https://</code> link. Empty = the tap just closes it.</li>
          <li><b>Who sees it</b> — everyone, only creators, only brands, or people who installed the app but haven't signed up.</li>
          <li><b>How often</b> — once per person, once a day, or every time the app opens.</li>
          <li><b>Starts / Ends</b> — optional. Empty start = live right after you save. Empty end = stays until you turn it off.</li>
          <li><b>Priority</b> — a phone shows only <b>one</b> popup (and one profile banner) at a time. If two are live for the same people, the one with the <b>higher number</b> shows; the other waits. Same number → the newest wins. Only one promo live? Leave it 0.</li>
          <li><b>Live</b> — tick = users can see it. Untick = saved but hidden.</li>
        </ol>
        <p className="mt-2 text-gray-500">After you save: the popup shows the next time someone opens the app or comes back to it (within about a minute). People who already saw a "once" popup won't see it again — edit it (or make a new one) to show it again.</p>
      </details>

      {form && (
        <div className="mt-5 grid md:grid-cols-[1fr_260px] gap-6 bg-white border border-gray-100 rounded-2xl p-5">
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-gray-500 uppercase">Name (only admins see it)</label><input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Diwali invite offer" /></div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Layout</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                {LAYOUTS.map((l) => (
                  <button key={l.id} type="button" onClick={() => set("layout", l.id)} className={`text-left p-3 rounded-xl border ${form.layout === l.id ? "border-purple-600 bg-purple-50" : "border-gray-200"}`}>
                    <div className="text-sm font-bold text-gray-900">{l.label}</div><div className="text-[11.5px] text-gray-500 mt-0.5">{l.hint}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] font-semibold text-purple-700" data-testid="promo-size-hint">Designer size: {SIZES[form.layout]}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Poster</label>
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => fileRef.current?.click()} className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-bold flex items-center gap-2"><Upload size={15} /> {uploading ? "Uploading…" : form.image_url ? "Change poster" : "Upload poster"}</button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Tap opens</label>
              <input className={input} value={form.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="/creator/refer   or   https://…   (empty = just close)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-gray-500 uppercase">Who sees it</label>
                <select className={input} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
                  <option value="all">Everyone signed in</option><option value="creator">Creators</option><option value="brand">Brands</option><option value="guest">Not signed up yet (installed app)</option>
                </select></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">How often</label>
                <select className={input} value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                  <option value="once">Once per person</option><option value="daily">Once a day</option><option value="every_open">Every app open</option>
                </select></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Starts (optional)</label><input type="datetime-local" className={input} value={toLocal(form.starts_at)} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Ends (optional)</label><input type="datetime-local" className={input} value={toLocal(form.ends_at)} onChange={(e) => set("ends_at", e.target.value)} /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Priority (higher wins)</label><input type="number" className={input} value={form.priority} onChange={(e) => set("priority", e.target.value)} />
                <p className="mt-1 text-[11.5px] text-gray-500">Only matters if 2+ promos are live for the same people. Bigger number shows first.</p></div>
              <label className="flex items-center gap-2 mt-6 text-sm font-bold text-gray-800"><input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Live (users can see it)</label>
            </div>
            {/* v332: Cancel on the left, Save on the right (AGENTS.md button order) */}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-bold">Cancel</button>
              <button type="button" onClick={save} disabled={busy || uploading || !form.image_url} className="h-11 px-5 rounded-xl bg-purple-600 text-white text-sm font-bold disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Preview</div>
            <div className="relative mx-auto rounded-[28px] overflow-hidden border-4 border-gray-900 bg-[#F4F4F8]" style={{ width: 240, aspectRatio: "390 / 844" }}>
              {form.image_url && (form.layout === "fullscreen" ? (
                <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : form.layout === "banner" ? (
                <div className="absolute inset-x-3 top-24"><div className="h-16 rounded-xl bg-white mb-2" /><img src={form.image_url} alt="" className="w-full object-cover rounded-lg" style={{ aspectRatio: RATIO.banner }} /></div>
              ) : form.layout === "card" ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><img src={form.image_url} alt="" className="w-[86%] object-cover rounded-2xl" style={{ aspectRatio: RATIO.card }} /></div>
              ) : (
                <div className="absolute inset-0 bg-black/60"><img src={form.image_url} alt="" className="absolute bottom-0 left-0 w-full object-cover rounded-t-2xl" style={{ aspectRatio: RATIO.sheet }} /></div>
              ))}
              {form.image_url && form.layout !== "banner" && <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 text-[12px] font-bold flex items-center justify-center">✕</div>}
              {!form.image_url && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 px-6 text-center">Upload a poster to see it here</div>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {items.map((p) => {
          const [label, fg, bg] = status(p);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white border border-gray-100 rounded-2xl p-3" data-testid="promo-row">{/* v332: wraps on phones */}
              {p.image_url ? <img src={p.image_url} alt="" className="w-14 h-20 object-cover rounded-lg bg-gray-100 shrink-0" /> : <div className="w-14 h-20 rounded-lg bg-gray-100 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-gray-900 truncate">{p.title || "Untitled promo"}</span><span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: fg, background: bg }}>{label}</span></div>
                <div className="text-xs text-gray-500 mt-0.5">{LAYOUTS.find((l) => l.id === p.layout)?.label || "—"} · {AUD_LABEL[p.audience] || p.audience || "—"} · {FREQ_LABEL[p.frequency] || String(p.frequency || "—").replace("_", " ")} · → {p.link_url || "close"}{/* v332 */}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex gap-3"><span className="flex items-center gap-1"><Eye size={12} /> {p.views || 0}</span><span className="flex items-center gap-1"><MousePointerClick size={12} /> {p.clicks || 0}</span></div>
              </div>
              <button type="button" disabled={rowBusy === p.id} onClick={() => toggle(p)} className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-bold disabled:opacity-50">{p.is_active ? "Turn off" : "Turn on"}</button>
              <button type="button" onClick={() => setForm({ ...p })} aria-label="Edit promo" className="p-2 rounded-xl bg-gray-50"><Pencil size={15} /></button>
              <button type="button" disabled={rowBusy === p.id} onClick={() => remove(p)} aria-label="Delete promo" className="p-2 rounded-xl bg-red-50 text-red-600 disabled:opacity-50"><Trash2 size={15} /></button>{/* v332: aria-labels */}
            </div>
          );
        })}
        {!items.length && !err && !form && <p className="text-sm text-gray-500">{loaded ? "No promo popups yet." : "Loading…"}</p>}
      </div>
    </div>
  );
}

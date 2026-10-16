import React from "react";
import { Edit2, Plus, Trash2, FolderKanban, Play } from "lucide-react";
import { toast } from "sonner";


// Session 49 (clean-up): moved out of CreatorMobileProfile.jsx word for word — the "portfolio" screen.
// Everything it needs comes in as props from CreatorMobileProfile; no logic or server call changed.
import { portfolioLinkInfo } from "./portfolioLinkInfo";

export default function PortfolioScreen(props) {
  const { handleDeletePortfolioItem, handleOpenEditPortfolioModal, pasteBrand, pasteLink, profile, renderBackHeader, saveProfileChanges, savingPaste, setPasteBrand, setPasteLink, setSavingPaste } = props;

    const portfolioList = profile?.portfolio || [];
    const linkInfo = portfolioLinkInfo(pasteLink);
    const addPastedLink = async () => {
      if (!linkInfo.ok || savingPaste) return;
      setSavingPaste(true);
      try {
        const item = {
          id: Date.now().toString(),
          title: pasteBrand.trim() ? `${pasteBrand.trim()} · ${linkInfo.label}` : linkInfo.label,
          brand_name: pasteBrand.trim(),
          platform: linkInfo.platform,
          content_url: linkInfo.url,
          description: "",
        };
        // v332: saveProfileChanges returns false on failure (it shows its own error) — no "Added" toast then
        if (saveProfileChanges && (await saveProfileChanges({ portfolio: [item, ...portfolioList] })) === false) return;
        setPasteLink("");
        setPasteBrand("");
        toast.success("Added to your portfolio");
      } catch (e) {
        toast.error("Couldn't add the link. Try again.");
      } finally {
        setSavingPaste(false);
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col pb-28">
        {renderBackHeader("Portfolio")}

        <div className="p-5 space-y-6">
          <div className="bg-[#F9F9FB] border border-[#EDEDF2] rounded-2xl p-4 space-y-2.5">
            <p className="text-xs text-slate-600 font-medium">Paste a link to a post or video you made.</p>{/* v332: inputs below are 16px so iPhone doesn't zoom */}
            <input
              value={pasteLink}
              onChange={(e) => setPasteLink(e.target.value)}
              inputMode="url"
              placeholder="https://instagram.com/reel/..."
              aria-label="Portfolio link"
              className="w-full h-12 bg-white border border-[#EDEDF2] rounded-xl px-3.5 text-[16px] font-medium text-slate-900 focus:outline-none focus:border-[#7C3AED]"
            />
            {pasteLink.trim() && !linkInfo.ok && (
              <p className="text-[11px] text-rose-500 font-medium">This doesn't look like a link. Paste the full link.</p>
            )}
            {linkInfo.ok && (
              <p className="text-[11px] text-slate-500 font-medium">{linkInfo.label}</p>
            )}
            <input
              value={pasteBrand}
              onChange={(e) => setPasteBrand(e.target.value)}
              placeholder="Brand (optional)"
              aria-label="Brand (optional)"
              className="w-full h-12 bg-white border border-[#EDEDF2] rounded-xl px-3.5 text-[16px] font-medium text-slate-900 focus:outline-none focus:border-[#7C3AED]"
            />
            <button
              type="button"
              onClick={addPastedLink}
              disabled={!linkInfo.ok || savingPaste}
              className="w-full h-11 bg-[#7C3AED] text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Plus size={14} /> {savingPaste ? "Adding…" : "Add to portfolio"}
            </button>
          </div>

          {portfolioList.length > 0 ? (
            <div className="space-y-3">
              {portfolioList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#F9F9FB] border border-[#EDEDF2] rounded-2xl p-4 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">{/* v330: long titles truncate; edit/delete stay visible */}
                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center shrink-0">
                      <Play size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">{item.title || portfolioLinkInfo(item.content_url).label || "Portfolio item"}</h4>
                      {item.content_url ? (
                        <a href={item.content_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#7C3AED] font-semibold block truncate max-w-[180px]">
                          Open link
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium block">{item.brand_name || ""}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPortfolioModal(idx)}
                      aria-label="Edit portfolio item" /* v330: icon-only buttons, 36px targets */
                      className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-[#7C3AED]"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePortfolioItem(idx)}
                      aria-label="Delete portfolio item"
                      className="w-9 h-9 flex items-center justify-center text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#F9F9FB] border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <FolderKanban size={28} className="mx-auto text-slate-400" />
              <h5 className="text-xs font-bold text-slate-700">No portfolio items yet</h5>
              <p className="text-[11px] text-slate-400">Add past videos, reels, and brand campaigns.</p>
            </div>
          )}
        </div>
      </div>
    );
  
}

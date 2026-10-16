import React from "react";
import { Shield } from "lucide-react";


// Session 49 (clean-up): moved out of CreatorMobileProfile.jsx word for word — the "platforms" screen.
// Everything it needs comes in as props from CreatorMobileProfile; no logic or server call changed.
export default function PlatformsScreen(props) {
  const { connectedSocials, handleOpenPlatformEdit, handleRemovePlatform, notConnectedSocials, profile, renderBackHeader } = props;

    return (
      <div className="min-h-screen bg-white flex flex-col pb-28">
        {renderBackHeader("Social platforms")}

        <div className="p-5 space-y-6">
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Add the platforms you post on. You enter the numbers yourself, so keep them accurate — brands compare them against delivered results.
          </p>

          {/* Section: Added Platforms */}
          {connectedSocials.length > 0 && (
            <div className="space-y-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Added · {connectedSocials.length}
              </span>

              <div className="space-y-3">
                {connectedSocials.map((platform) => {
                  const Icon = platform.icon;
                  const data = platform.data || {};
                  const followersFormatted = data.followers ? Number(data.followers).toLocaleString('en-IN') : "—";
                  const reachFormatted = data.reach ? Number(data.reach).toLocaleString('en-IN') : "—";
                  const engRate = data.followers && (data.likes || data.comments)
                    ? (((Number(data.likes || 0) + Number(data.comments || 0)) / Number(data.followers)) * 100).toFixed(2) + "%"
                    : "—"; // v330: no likes/comments entered → "—", not a misleading 0.00%

                  return (
                    <div
                      key={platform.id}
                      className="bg-[#FBF8FF] border border-[#7C3AED] rounded-2xl p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${platform.bg} ${platform.text}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">{/* v330: long channel / profile URLs truncate instead of overflowing */}
                            <h4 className="text-xs font-black text-slate-900">{platform.name}</h4>
                            <span className="text-[11px] font-bold text-slate-500 block truncate">
                              {/* v332: a pasted link showed as "@https://…", and an empty one as "@handle" */}
                              {(() => { const h = String(data.handle || data.url || "").trim(); return !h ? "Handle not added" : /^https?:\/\//i.test(h) ? h.replace(/^https?:\/\/(www\.)?/i, "") : `@${h.replace(/^@/, "")}`; })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3-Column Stats Box (Instagram / Metrics) */}
                      {platform.hasMetrics && (
                        <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-2.5 border border-purple-100 text-center">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Followers</span>
                            <span className="text-xs font-black text-slate-900">{followersFormatted}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Avg Reach</span>
                            <span className="text-xs font-black text-slate-900">{reachFormatted}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Engagement</span>
                            <span className="text-xs font-black text-[#7C3AED]">{engRate}</span>
                          </div>
                        </div>
                      )}

                      {/* Session 40: "Verified by Ybex" once the Ybex team approved the profile; until then Pending. */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-medium">Numbers you entered — not synced from {platform.name}.</span>
                        {String(profile?.profile_status || "").toLowerCase() === "approved" ? (
                          <span className="shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Verified by Ybex</span>
                        ) : (
                          <span className="shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
                        )}
                      </div>

                      {/* Action buttons: Update / Remove */}
                      {/* v330: primary "Update" on the right, "Remove" on the left (app button rule); 36px tap height */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRemovePlatform(platform.id)}
                          className="min-h-9 px-3 py-1.5 bg-white border border-rose-200 text-[#E8552F] text-xs font-bold rounded-xl hover:bg-rose-50 transition-all"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPlatformEdit(platform.id)}
                          className="min-h-9 px-3 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-2xs transition-all"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Not Added Yet */}
          {notConnectedSocials.length > 0 && (
            <div className="space-y-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Not Added Yet
              </span>

              <div className="space-y-2.5">
                {notConnectedSocials.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div
                      key={platform.id}
                      className="min-h-[66px] py-2 gap-2 bg-white border border-[#EDEDF2] rounded-2xl px-4 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-all"
                    >
                      {/* v330: fixed 66px height + no min-w-0 squeezed the "+ Add" button at 320px */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${platform.bg} ${platform.text}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900">{platform.name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium block">{platform.pitch}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPlatformEdit(platform.id)}
                        className="shrink-0 min-h-9 px-3.5 py-1.5 bg-white border-1.5 border-[#7C3AED] text-[#7C3AED] hover:bg-[#F3EBFF] text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No account access assurance */}
          <div className="bg-[#F9F9FB] border border-[#EDEDF2] rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
            <Shield size={18} className="text-[#7C3AED] shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-slate-900">No account access</h5>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                Ybex never logs into your accounts — you enter and update these details yourself.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  
}

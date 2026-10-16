import React, { useState } from "react";
import PayConsentLine from "../../legal/PayConsentLine";
import { Shield, Check, Clock, Loader2, Lock, X, RotateCcw, HelpCircle, Smartphone, CreditCard, Landmark, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileSheet, { SheetHeader } from "./MobileSheet";

// Session 23. This sheet used to say "Payment secured · ₹X is held in a secure payment hold" and
// a "free" platform fee for EVERY deal — before any payment, with a fee the server does not
// charge. "Make payment" opened it and nothing was paid. Now:
//   - funded      → the real status (held in escrow until approval);
//   - brand, not funded → a real "Pay into a secure payment hold" button (same Razorpay flow as desktop);
//     the exact total (fees/GST, if any) is shown by the payment screen itself, not guessed here;
//   - creator, not funded → "waiting for the brand to fund".
// Session 57 — Ravi's Money screens design (PY-10 review · PY-12 success · PY-13 not completed), in the
// app UI. UPI / card / netbanking are chosen inside Razorpay's own secure window (card details never
// touch Ybex), so this sheet shows the summary before it and the result after it.
// v332: "₹0" / "Pay ₹0" showed when the amount wasn't loaded yet — a dash instead (Razorpay shows the real total).
const inr = (n) => (Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—");
const F = "'DM Sans',sans-serif";

// Session 58 (Ravi: "GPay / PhonePe ki image nahi hai, bas likh rakha hai … fully functional banao"): the brand now
// PICKS how to pay. The choice opens Razorpay straight on that method (prefill.method) — the money still moves
// only inside Razorpay's own window. Payment-app marks are the companies' own artwork, so they are not drawn
// here: drop the official files in public/pay-logos/ (names in PAY_LOGOS) and they show up; until then a
// clean name chip is shown in their place.
export const PAY_METHODS = [
  { id: "upi", title: "UPI", sub: "Pay from any UPI app", Icon: Smartphone, apps: ["gpay", "phonepe", "paytm"], tag: "Fastest" },
  { id: "card", title: "Debit / Credit card", sub: "Visa, Mastercard, RuPay, Amex", Icon: CreditCard, apps: ["visa", "mastercard", "rupay"] },
  { id: "netbanking", title: "Netbanking", sub: "SBI, HDFC, ICICI, Axis + 50 banks", Icon: Landmark, apps: [] },
];
export const PAY_LOGOS = { gpay: "Google Pay", phonepe: "PhonePe", paytm: "Paytm", bhim: "BHIM", visa: "Visa", mastercard: "Mastercard", rupay: "RuPay" };
function PayLogo({ id }) {
  const [failed, setFailed] = useState(false);
  const name = PAY_LOGOS[id] || id;
  if (!failed) {
    return (
      <span style={{ height: 22, minWidth: 34, padding: "0 5px", borderRadius: 6, background: "#fff", border: "1px solid #ECEAF2", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <img src={`/pay-logos/${id}.svg`} alt={name} title={name} onError={() => setFailed(true)} style={{ height: 14, maxWidth: 46, objectFit: "contain", display: "block" }} />
      </span>
    );
  }
  return <span style={{ height: 22, padding: "0 7px", borderRadius: 6, background: "#F4F2F8", border: "1px solid #ECEAF2", font: `700 10.5px ${F}`, color: "#4B4560", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>{name}</span>;
}

export default function MobileEscrowSheet({ onClose, amount, isBrand, isFunded, isDealCompleted, onPay, paying, campaignTitle = "", partnerName = "" }) {
  const navigate = useNavigate();
  const [result, setResult] = useState(null); // null | "ok" | "failed"
  const [method, setMethod] = useState("upi");
  const picked = PAY_METHODS.find((m) => m.id === method) || PAY_METHODS[0];
  const Row = ({ label, value, strong }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ font: `500 13px ${F}`, color: "#6B6578" }}>{label}</span>
      <span style={{ font: `${strong ? 800 : 600} 13px ${F}`, color: "#14111C", textAlign: "right" }}>{value}</span>
    </div>
  );

  const pay = async () => {
    if (paying) return;
    const ok = await onPay?.(method);
    setResult(ok ? "ok" : "failed");
  };

  // PY-12 · payment successful
  if (result === "ok") {
    return (
      <MobileSheet onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 6 }} data-testid="escrow-paid">
          <div style={{ width: 60, height: 60, borderRadius: 30, background: "#E3F7EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={30} color="#0E9F6E" strokeWidth={3} />
          </div>
          <div style={{ marginTop: 12, font: `800 20px ${F}`, color: "#14111C" }}>Payment successful</div>
          <div style={{ marginTop: 2, font: `800 30px ${F}`, color: "#14111C", letterSpacing: "-0.5px" }}>{inr(amount)}</div>
          <div style={{ marginTop: 6, font: `500 13.5px/1.5 ${F}`, color: "#6B6578" }}>
            Escrow funded.{partnerName ? ` ${partnerName} is hired` : ""}{campaignTitle ? ` for ${campaignTitle}` : ""}.
          </div>
        </div>
        <div style={{ marginTop: 16, borderRadius: 16, background: "#F7F6FA", padding: 14 }}>
          <div style={{ font: `800 11px ${F}`, letterSpacing: "1px", color: "#6B6578" }}>WHAT HAPPENS NEXT</div>
          {[
            `${partnerName || "The creator"} gets notified and starts on the brief.`,
            "You review the draft in this chat.",
            `Escrow releases to ${partnerName || "the creator"} only after you approve.`,
          ].map((t, i) => (
            <div key={t} style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: "#F2EAFF", color: "#7C3AED", font: `800 12px ${F}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ font: `500 13px/1.45 ${F}`, color: "#14111C" }}>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", height: 50, borderRadius: 14, background: "#7C3AED", border: "none", font: `700 15px ${F}`, color: "#fff", cursor: "pointer" }}>
          Back to the deal chat
        </button>
        <button onClick={() => navigate("/brand/payments")} style={{ marginTop: 8, width: "100%", height: 46, borderRadius: 14, background: "#fff", border: "1px solid #E2DFEA", font: `700 14px ${F}`, color: "#5B16C9", cursor: "pointer" }}>
          View in Payments · GST invoice
        </button>
      </MobileSheet>
    );
  }

  // PY-13 · not completed
  if (result === "failed") {
    return (
      <MobileSheet onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 6 }} data-testid="escrow-failed">
          <div style={{ width: 60, height: 60, borderRadius: 30, background: "#FEECEC", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={28} color="#DC2626" strokeWidth={3} />
          </div>
          <div style={{ marginTop: 12, font: `800 20px ${F}`, color: "#14111C" }}>Payment didn't go through</div>
          <div style={{ marginTop: 6, font: `500 13.5px/1.5 ${F}`, color: "#6B6578" }}>
            It was cancelled, declined or timed out. {partnerName ? `${partnerName} isn't hired yet` : "Nothing changed on this deal"} — you can try again.
          </div>
        </div>
        <div style={{ marginTop: 16, borderRadius: 16, background: "#FFF8EB", border: "1px solid #FBE3B5", padding: 14 }}>
          <div style={{ font: `700 13.5px ${F}`, color: "#7A4A06" }}>Money debited from your bank?</div>
          <div style={{ marginTop: 4, font: `500 12.5px/1.5 ${F}`, color: "#92612A" }}>
            If it was taken and this deal still shows unpaid, it is recorded automatically within a few minutes, or returned to the same account by Razorpay. You will never be charged twice for this deal.
          </div>
        </div>
        <button onClick={() => { setResult(null); }} style={{ marginTop: 16, width: "100%", height: 50, borderRadius: 14, background: "#7C3AED", border: "none", font: `700 15px ${F}`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <RotateCcw size={16} /> Try again{Number(amount) > 0 ? ` · ${inr(amount)}` : ""}
        </button>
        <button onClick={() => navigate("/help/tickets")} style={{ marginTop: 8, width: "100%", height: 46, borderRadius: 14, background: "#fff", border: "1px solid #E2DFEA", font: `700 14px ${F}`, color: "#14111C", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <HelpCircle size={15} /> Need help? Contact Ybex support
        </button>
      </MobileSheet>
    );
  }

  const state = isDealCompleted ? "released" : isFunded ? "held" : isBrand ? "pay" : "waiting";
  const note = {
    released: { icon: <Check size={17} color="#0E9F6E" strokeWidth={2.3} />, bg: "#E3F7EE", title: "Payment released", body: "The deal is complete and secure payment hold has been released.", c1: "#0E7A55", c2: "#0E7A55" },
    // v332: the brand was told "…after the brand approves" about itself; no "— is held" without an amount
    held: { icon: <Check size={17} color="#0E9F6E" strokeWidth={2.3} />, bg: "#E3F7EE", title: "Payment secured", body: `${Number(amount) > 0 ? inr(amount) : "The payment"} is held in a secure payment hold and is released only after ${isBrand ? "you approve" : "the brand approves"} the delivery.`, c1: "#0E7A55", c2: "#0E7A55" },
    pay: { icon: <Lock size={16} color="#7C3AED" strokeWidth={2.2} />, bg: "#F5F0FF", title: "Money stays locked in Ybex escrow", body: `It moves to ${partnerName || "the creator"} only after you approve the draft. Full refund if the deadline is missed.`, c1: "#5B16C9", c2: "#6D28D9" },
    waiting: { icon: <Clock size={17} color="#D97706" strokeWidth={2.1} />, bg: "#FFFBEB", title: "Waiting for the brand", body: "Start work only after the brand funds the secure payment hold — you'll be notified here.", c1: "#92400E", c2: "#B45309" },
  }[state];

  return (
    <MobileSheet onClose={onClose}>
      <SheetHeader title={state === "pay" ? "Review & pay" : "Secure payment hold"} subtitle={state === "pay" ? "Fund escrow to hire · secure checkout" : "Funds stay protected until delivery is approved."} onClose={onClose} />

      {/* PY-10 · review before Razorpay's secure window */}
      <div style={{ marginTop: 14, borderRadius: 16, background: "#F7F6FA", border: "1px solid #EEEDF3", padding: 14 }} data-testid="escrow-review">
        {(partnerName || campaignTitle) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#F2EAFF", color: "#7C3AED", font: `800 15px ${F}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {String(partnerName || campaignTitle || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              {partnerName && <div style={{ font: `700 14px ${F}`, color: "#14111C", overflowWrap: "anywhere" }}>{isBrand ? `Hiring ${partnerName}` : partnerName}</div>}
              {campaignTitle && <div style={{ font: `500 12px ${F}`, color: "#6B6578", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" /* v332: was a fixed 240px */ }}>{campaignTitle}</div>}
            </div>
          </div>
        )}
        {state === "pay" ? (
          <>
            <div style={{ font: `600 12px ${F}`, color: "#6B6578" }}>You pay now</div>
            <div style={{ font: `800 30px ${F}`, color: "#14111C", letterSpacing: "-0.5px", marginBottom: 10 }}>{inr(amount)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Row label="Agreed amount" value={inr(amount)} />
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Row label="Deal amount" value={inr(amount)} />
            <Row label="Status" value={state === "released" ? "Released" : state === "held" ? "Held in a secure payment hold" : "Not funded"} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 11, padding: "13px 14px", borderRadius: 14, background: note.bg }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>{note.icon}</div>
        <div>
          <div style={{ font: `700 13px ${F}`, color: note.c1 }}>{note.title}</div>
          <div style={{ marginTop: 3, font: `500 12.5px/1.5 ${F}`, color: note.c2 }}>{note.body}</div>
        </div>
      </div>

      {state === "pay" ? (
        <>
          <div style={{ marginTop: 16, font: `800 11px ${F}`, letterSpacing: "1px", color: "#6B6578" }}>CHOOSE HOW TO PAY</div>
          <div role="radiogroup" aria-label="Payment method" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {PAY_METHODS.map((m) => {
              const on = m.id === method;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMethod(m.id)} disabled={paying} data-testid={`pay-method-${m.id}`}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 14, cursor: paying ? "default" : "pointer",
                    border: on ? "2px solid #7C3AED" : "1px solid #E7E5EE", background: on ? "#FAF7FF" : "#fff", boxShadow: on ? "0 6px 18px -10px rgba(124,58,237,.55)" : "none", transition: "border-color .15s ease, background .15s ease" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: on ? "#7C3AED" : "#F2EAFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s ease" }}>
                    <m.Icon size={19} color={on ? "#fff" : "#7C3AED"} strokeWidth={2} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ font: `700 14px ${F}`, color: "#14111C" }}>{m.title}</span>
                      {m.tag && <span style={{ height: 18, padding: "0 7px", borderRadius: 9, background: "#E3F7EE", color: "#0E7A55", font: `800 9.5px ${F}`, letterSpacing: ".4px", display: "inline-flex", alignItems: "center" }}>{m.tag.toUpperCase()}</span>}
                    </span>
                    <span style={{ display: "block", font: `500 11.5px ${F}`, color: "#6B6578", marginTop: 1 }}>{m.sub}</span>
                    {m.apps.length > 0 && <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>{m.apps.map((a) => <PayLogo key={a} id={a} />)}</span>}
                  </span>
                  <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 10, border: on ? "6px solid #7C3AED" : "2px solid #CFCBDA", background: "#fff", flexShrink: 0, boxSizing: "border-box", transition: "border .15s ease" }} />
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, font: `500 11.5px ${F}`, color: "#6B6578", textAlign: "center" }}>
            <BadgeCheck size={14} color="#0E9F6E" style={{ flexShrink: 0 }} />
            <span>{method === "upi" ? "Razorpay opens on UPI — pick your app or scan the QR." : method === "card" ? "Razorpay opens on cards." : "Razorpay opens on netbanking — pick your bank."} Card details never reach Ybex.</span>
          </div>
          <PayConsentLine style={{ marginTop: 12 }} />
          <button
            disabled={paying}
            onClick={pay}
            data-testid="escrow-pay"
            style={{ marginTop: 14, width: "100%", height: 52, borderRadius: 14, background: "#7C3AED", border: "none", font: `700 15px ${F}`, color: "#fff", cursor: paying ? "default" : "pointer", opacity: paying ? 0.75 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {paying ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            <span>{paying ? "Waiting for payment…" : `Pay ${Number(amount) > 0 ? `${inr(amount)} ` : ""}with ${picked.id === "card" ? "card" : picked.title}`}</span>
          </button>
          <div style={{ marginTop: 8, textAlign: "center", font: `500 11.5px/1.4 ${F}`, color: "#8E8A99" }}>
            Payments processed by Razorpay. The payment screen shows the exact total before you confirm.
          </div>
        </>
      ) : (
        <button
          onClick={onClose}
          style={{ marginTop: 16, width: "100%", height: 52, borderRadius: 14, background: "#7C3AED", border: "none", font: `700 15px ${F}`, color: "#fff", cursor: "pointer" }}
        >
          Back to chat
        </button>
      )}
    </MobileSheet>
  );
}

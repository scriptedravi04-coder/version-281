// Session 22. Fields a public profile must never show to other users.
const PRIVATE_KEY = /^(email|e_mail|phone|phone_number|mobile|whatsapp.*|contact_.*|personal_.*|bank.*|account.*|ifsc.*|upi.*|pan|pan_.*|aadhaar.*|aadhar.*|gst.*|gstin|address|full_address|pincode|password.*|.*_kyc.*|kyc.*|payout_.*|beneficiary.*|dob|date_of_birth)$/i;

export function stripPrivateProfileFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PRIVATE_KEY.test(k) || /(_email|_phone|_mobile)$/i.test(k)) continue;
    // Session 58 (security): a creator's date of birth is also saved INSIDE rate_card — strip one level deep too.
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner: any = {};
      for (const [k2, v2] of Object.entries(v)) { if (!(PRIVATE_KEY.test(k2) || /(_email|_phone|_mobile)$/i.test(k2))) inner[k2] = v2; }
      out[k] = inner;
      continue;
    }
    out[k] = v;
  }
  return out;
}

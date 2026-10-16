// Notification helpers: in-app notifications, admin broadcasts, activity / super-admin emails.
// Moved out of server.ts in session 22 — behaviour unchanged. Admin alerts reach admins only
// (see docs/code/ARCHITECTURE.md "PROTECTED CHANGES" #16).
const escapeHtml = (v: any): string => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]); // Session 58
import { Resend, buildEmailHtml } from "./helpers";
import { ADMIN_ROOM } from "./socketAccess";

export function createNotificationService(deps: {
  clients: () => { supabase: any; privilegedSupabase: any };
  getDb: () => any;
  saveDb: (db: any) => void;
  getIsoNow: () => string;
  app: any;
}) {
  async function broadcastAdminNotification({
    type,
    message,
    metadata = {},
    actor_id,
    title
  }: {
    type: string;
    message: string;
    metadata?: any;
    actor_id?: string;
    title?: string;
  }) {
    try {
      const notifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const createdAt = deps.getIsoNow();
      const payload: any = {
        notif_id: notifId,
        user_id: 'admin',
        type: type || 'admin_system_alert',
        message: message,
        title: title || null,
        read: false,
        is_admin_message: true,
        created_at: createdAt
      };

      // 1. Insert into local DB
      const db = deps.getDb();
      if (!db.notifications) db.notifications = [];
      db.notifications.unshift(payload);
      deps.saveDb(db);

      // 2. Insert into Supabase notifications table
      if (deps.clients().supabase) {
        try {
          const { data: adminUsers } = await deps.clients().supabase
            .from('users')
            .select('user_id')
            .or('role.eq.admin,role.eq.sub_admin,team_role.eq.sub_admin');
          
          // No copy for the 'all' audience. That is the platform-wide broadcast list — every
          // creator and brand reads it — so each admin alert (a new signup's name, email and
          // role, KYC submissions, …) used to land in every user's notification list.
          // Session 58: notifications.user_id must be a real user (foreign key) — the extra 'admin' row made the WHOLE
          // insert fail, so payout-due / refund-due / KYC alerts never reached any admin's bell or phone. One row per
          // admin now; event_type keeps them out of the blocking pop-up.
          const rowsToInsert: any[] = [];

          if (adminUsers && adminUsers.length > 0) {
            adminUsers.forEach((adm: any) => {
              if (adm.user_id && adm.user_id !== 'admin') {
                rowsToInsert.push({
                  ...payload,
                  notif_id: notifId + "_" + (adm.user_id || '').slice(-6),
                  user_id: adm.user_id,
                  event_type: payload.type || 'admin_system_alert',
                });
              }
            });
          }

          if (rowsToInsert.length) {
            const { error: insErr } = await (deps.clients().privilegedSupabase || deps.clients().supabase).from('notifications').insert(rowsToInsert);
            if (insErr) console.error("[Admin Notification] not saved:", insErr.message);
          }
        } catch (sErr) {
          console.warn("[Admin Notification Supabase Insert Warning]", sErr);
        }
      }

      // 3. Emit real-time Socket.io events
      const ioInstance = deps.app.get("io");
      if (ioInstance) {
        // Admins only. This also emitted to EVERY socket (the old admin room it targeted had no
        // members), so each admin alert popped up live for every user.
        ioInstance.to(ADMIN_ROOM).emit("admin_notification", payload);
        ioInstance.to(ADMIN_ROOM).emit("bell_notification", payload);
        ioInstance.to(ADMIN_ROOM).emit("new_notification", payload);
      }
      return payload;
    } catch (err) {
      console.error("[Broadcast Admin Notification Error]", err);
    }
  }

  async function sendActivityNotificationEmail({
    toEmail,
    recipientName,
    type,
    message
  }: {
    toEmail: string;
    recipientName: string;
    type: string;
    message: string;
  }) {
    if (!toEmail || !toEmail.includes('@') || toEmail.endsWith('.demo') || toEmail.includes('@example.com') || toEmail.endsWith('@ybex.io')) return;
    // Session 58 (Ravi: "user ko warning vali mail ka jhanjhat hatana hai"): warning / suspend / ban no longer
    // email the user. The in-app notice, the violation record and the super-admin alert stay as they were.
    const accountActionType = String(type || '').toUpperCase();
    if (["WARN", "WARNING", "ACCOUNT_WARNING", "SUSPEND", "SUSPENDED", "ACCOUNT_SUSPENDED", "BAN", "BANNED", "ACCOUNT_BANNED"].includes(accountActionType)) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[Resend Notification Skipped - No RESEND_API_KEY] To: ${toEmail} | Message: ${message}`);
      return;
    }

    try {
      const resendClient = new Resend(apiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Ybex <noreply@ybexmedia.in>";
      const appBaseUrl = process.env.APP_URL || 'https://ybexmedia.in';

      let subject = 'New activity on Ybex Media';
      let heading = 'Platform Notification';
      let ctaLabel = 'View Dashboard';
      let ctaUrl = '/';

      const normalizedType = (type || '').toUpperCase();

      // v291 (Ravi): "KYC approved" and "profile approved" mails used the content-approval subject because
      // every type containing APPROVED fell into the content branch. Account-level types come first now.
      if (normalizedType.includes('KYC')) {
        const kycOk = normalizedType.includes('APPROVED') || normalizedType.includes('VERIFIED');
        const kycNo = normalizedType.includes('REJECT') || normalizedType.includes('FAIL');
        subject = kycOk ? `✅ Your Ybex KYC is approved` : kycNo ? `⚠️ Your Ybex KYC needs attention` : `Update on your Ybex KYC`;
        heading = kycOk ? `Your KYC is verified` : kycNo ? `Your KYC could not be approved` : `Your KYC status was updated`;
        ctaLabel = kycOk ? `Open Your Profile` : `Check KYC Status`;
        ctaUrl = `/profile`;
      } else if (normalizedType.includes('PROFILE') && (normalizedType.includes('APPROVED') || normalizedType.includes('LIVE'))) {
        subject = `🎉 Your Ybex profile is approved`;
        heading = `Your profile is approved`;
        ctaLabel = `Open Ybex`;
        ctaUrl = `/`;
      } else if (normalizedType.includes('PROFILE') && normalizedType.includes('REJECT')) {
        subject = `Update on your Ybex profile`;
        heading = `Your profile needs changes`;
        ctaLabel = `Open Your Profile`;
        ctaUrl = `/profile`;
      } else if (normalizedType.includes('PAYOUT')) {
        // Session 58: the admin's "payout request" mail used the "direct message from Ybex Admin" wording.
        const forAdmin = normalizedType.includes('ADMIN');
        subject = forAdmin ? `💸 Payout request waiting` : `💸 Update on your payout`;
        heading = forAdmin ? `A creator asked for a payout` : `Your payout was updated`;
        ctaLabel = forAdmin ? `Open payout requests` : `Open Earnings`;
        ctaUrl = forAdmin ? `/admin?tab=escrow&view=requests` : `/earnings`;
      } else if (normalizedType.includes('MESSAGE')) {
        subject = `💬 New Message from Ybex User`;
        heading = `You received a new message`;
        ctaLabel = `Reply in Chat`;
        ctaUrl = `/chat`;
      } else if (normalizedType.includes('APPLICATION') || normalizedType.includes('APPLY')) {
        subject = `📝 New Creator Application on Ybex`;
        heading = `A creator applied to your campaign!`;
        ctaLabel = `Review Applications`;
        ctaUrl = `/campaigns`;
      } else if (normalizedType.includes('OFFER')) {
        subject = `🤝 New Deal Offer Received`;
        heading = `You received a deal offer`;
        ctaLabel = `View Deal Terms`;
        ctaUrl = `/chat`;
      } else if (normalizedType.includes('DEAL_SIGNED') || normalizedType.includes('PAYMENT_RECEIVED') || normalizedType.includes('ESCROW')) {
        subject = `🎉 Deal Confirmed & Payment Secured`;
        heading = `Agreement signed & payment locked in the secure payment hold!`;
        ctaLabel = `Open Deal Workspace`;
        ctaUrl = `/collabs`;
      } else if (normalizedType.includes('SUBMITTED') || normalizedType.includes('UGC_READY') || normalizedType.includes('PROOF')) {
        subject = `🎬 Content / Proof Draft Uploaded`;
        heading = `Content deliverable submitted for review`;
        ctaLabel = `Review Deliverable`;
        ctaUrl = `/collabs`;
      } else if (normalizedType.includes('APPROVED')) {
        subject = `✅ Content Approved by Brand!`;
        heading = `Great news! Your content submission was approved`;
        ctaLabel = `View Next Steps`;
        ctaUrl = `/collabs`;
      } else if (normalizedType.includes('REJECTED') || normalizedType.includes('REVISION')) {
        subject = `⚡ Action Required: Content Revision Requested`;
        heading = `Revision feedback provided on deliverable`;
        ctaLabel = `View Feedback & Revise`;
        ctaUrl = `/collabs`;
      } else if (normalizedType.includes('BRIEF') || normalizedType.includes('COST')) {
        subject = `Brand Collaboration Inquiry`;
        heading = `A brand is interested in working with you!`;
        ctaLabel = `Open Chat & Respond`;
        ctaUrl = `/chat`;
      } else if (normalizedType.includes('WARNING')) {
        subject = `⚠️ Account Warning: Policy Compliance Notice`;
        heading = `Official Warning Issued on Your Ybex Account`;
        ctaLabel = `View Account Details`;
        ctaUrl = `/profile`;
      } else if (normalizedType.includes('SUSPEND')) {
        subject = `🚨 Account Temporary Suspension Notice`;
        heading = `Your account has been temporarily suspended`;
        ctaLabel = `Help & Support`;
        ctaUrl = `/help`;
      } else if (normalizedType.includes('BAN') || normalizedType.includes('DELETED')) {
        subject = `🛑 Important Ybex Account Status Update`;
        heading = `Your account status has been updated`;
        ctaLabel = `Contact Helpdesk`;
        ctaUrl = `/help`;
      } else if (normalizedType.includes('ADMIN') || normalizedType.includes('CUSTOM')) {
        subject = `📩 Official Direct Message from Ybex Management`;
        heading = `You received a direct message from Ybex Admin`;
        ctaLabel = `Open Dashboard`;
        ctaUrl = `/`;
      } else if (normalizedType.includes('TICKET') || normalizedType.includes('SUPPORT')) {
        subject = `🎧 Support Ticket Update - Ybex Helpdesk`;
        heading = `Update regarding your support ticket`;
        ctaLabel = `View Support Ticket`;
        ctaUrl = `/help`;
      }

      const fullCtaUrl = `${appBaseUrl}${ctaUrl.startsWith('/') ? '' : '/'}${ctaUrl}`;

      const htmlContent = buildEmailHtml({
      title: heading,
      greeting: "Hello,",
      paragraphs: [
        "<div style='white-space: pre-wrap;'>" + escapeHtml(message) + "</div>"
      ],
      button: ctaLabel ? { text: ctaLabel, link: fullCtaUrl } : undefined
    });

      const response = await resendClient.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject: subject,
        html: htmlContent
      });

      if (response.error) {
        console.warn(`[Resend Activity Mailer Error] ${toEmail}: ${response.error.message}`);
      } else {
        console.log(`[Resend Activity Mailer Success] Sent to ${toEmail} | Subject: ${subject}`);
      }
    } catch (err: any) {
      console.error(`[Resend Activity Mailer Exception] ${toEmail}:`, err?.message || err);
    }
  }

  async function sendSuperAdminAlertEmail({
    subject,
    title,
    details
  }: {
    subject: string;
    title: string;
    details: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const adminEmails = new Set<string>();
    if (process.env.ADMIN_EMAIL) adminEmails.add(process.env.ADMIN_EMAIL.toLowerCase());
    adminEmails.add('commonuseforpro@gmail.com');

    const recipients = Array.from(adminEmails).filter(e => e && e.includes('@') && !e.endsWith('@placeholder.demo'));
    if (recipients.length === 0) return;

    try {
      const resendClient = new Resend(apiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Ybex <noreply@ybexmedia.in>";
      const appUrl = process.env.APP_URL || 'https://ybexmedia.in';

      const htmlContent = buildEmailHtml({
      title: escapeHtml(subject),
      greeting: "Admin Team,",
      // Session 58: user-typed text (sign-up names, payout notes) is escaped — it could put a fake link in a real Ybex email.
      paragraphs: ["<pre style='background: #f8fafc; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #334155; white-space: pre-wrap;'>" + escapeHtml(details) + "</pre>"],
      button: { text: "Open Admin Dashboard", link: appUrl + "/admin" }
    });

      for (const adminEmail of recipients) {
        await resendClient.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject: `[ADMIN ALERT] ${subject}`,
          html: htmlContent
        }).catch(e => console.warn(`[SuperAdminAlert] Error sending to ${adminEmail}:`, e?.message));
      }
    } catch (err: any) {
      console.error("[SuperAdminAlert Exception]:", err?.message || err);
    }
  }

  async function sendNotification(db: any, userId: string, type: string, message: string) {
    if (!userId) {
      console.warn("[sendNotification] Warning: recipient userId is undefined or empty. Skipping notification.");
      return;
    }
    const notif_id = `notif_${Math.random().toString(36).substring(2, 11)}`;
    const created_at = deps.getIsoNow();

    const actualDb = db || deps.getDb();
    if (actualDb) {
      if (!actualDb.notifications) actualDb.notifications = [];
      actualDb.notifications.push({
        notif_id,
        user_id: userId,
        type,
        message,
        read: false,
        created_at
      });
      if (!db) {
        deps.saveDb(actualDb);
      }
    }

    // Trigger Resend email notification asynchronously in background
    (async () => {
      try {
        let recipientEmail: string | null = null;
        let recipientName: string = 'User';

        if (actualDb && actualDb.users) {
          const found = actualDb.users.find((u: any) => u.user_id === userId || u.id === userId);
          if (found && found.email) {
            recipientEmail = found.email;
            recipientName = found.full_name || found.name || found.brand_name || found.company_name || 'User';
          }
        }

        if (!recipientEmail && deps.clients().supabase) {
          const { data: uData } = await (deps.clients().privilegedSupabase || deps.clients().supabase).from('users').select('email, name').eq('user_id', userId).maybeSingle();
          if (uData && uData.email) {
            recipientEmail = uData.email;
            recipientName = uData.name || 'User';
          }
        }

        // Skip immediate email for routine chat messages to prevent email flooding/spam
        // Real-time notification is already sent to the UI/bell and socket
        const normType = (type || '').toUpperCase();
        if (normType.includes('MESSAGE') || normType === 'NEW_MESSAGE' || normType === 'CHAT') {
          return;
        }
        // Session 58 (Ravi: "emails kam karo"): bell + phone push only, no email, for these:
        // the brand just submitted the campaign itself; a fraud re-check note; warning / suspend / ban.
        if (['CAMPAIGN_UNDER_REVIEW', 'VERIFICATION', 'WARNING', 'SUSPEND', 'BAN'].includes(normType)) {
          return;
        }

        if (recipientEmail && recipientEmail.includes('@') && !recipientEmail.endsWith('@placeholder.demo')) {
          await sendActivityNotificationEmail({
            toEmail: recipientEmail,
            recipientName,
            type,
            message
          });
        }
      } catch (emailErr) {
        console.warn(`[sendNotification:Email] Failed to trigger activity email for ${userId}:`, emailErr);
      }
    })();

    if (deps.clients().supabase) {
      (async () => {
        try {
          // Check if recipient user exists in public.users to prevent foreign key violation
          const { data: userExists } = await deps.clients().supabase
            .from("users")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

          // Session 58: a missing recipient (e.g. an account an admin wiped) is skipped. It used to INSERT a fake,
          // onboarded user ("<id>@placeholder.demo") that then showed up in admin and user lists.
          if (!userExists) {
            console.warn(`[sendNotification] Recipient ${userId} not found — notification skipped.`);
            return;
          }

          const { error } = await (deps.clients().privilegedSupabase || deps.clients().supabase).from("notifications").insert({
            notif_id,
            user_id: userId,
            type,
            message,
            read: false,
            created_at
          });

          if (error) {
            console.log(`Supabase Realtime notification dispatch error for user ${userId}:`, error.message || error);
          } else {
            console.log(`Realtime notification triggered on Supabase for ${userId}: ${type}`);
          }
        } catch (err: any) {
          console.log(`Supabase Realtime notification catch error for user ${userId}:`, err?.message || err);
        }
      })();
    }
  }

  return { broadcastAdminNotification, sendActivityNotificationEmail, sendSuperAdminAlertEmail, sendNotification };
}

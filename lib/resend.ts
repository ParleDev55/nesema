import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Nesema <hello@nesema.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nesema.com";

// ─── Shared HTML template ───────────────────────────────────────────────────
function emailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nesema</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F3EE;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F3EE;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;">
          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#2E2620;letter-spacing:0.04em;">Nesema</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;border:1px solid #E6E0D8;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9C9087;">Health, felt whole.</p>
              <p style="margin:4px 0 0;font-size:11px;color:#BFB8B0;">
                You're receiving this because you have an account on Nesema.
                <a href="${APP_URL}/settings" style="color:#4E7A5F;text-decoration:none;">Manage preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:#4E7A5F;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:100px;font-size:14px;font-weight:600;margin-top:8px;">${text}</a>`;
}

// ─── Welcome — Practitioner ─────────────────────────────────────────────────
export async function sendPractitionerWelcome({
  to,
  firstName,
  bookingSlug,
}: {
  to: string;
  firstName: string;
  bookingSlug: string;
}) {
  const bookingUrl = `${APP_URL}/book/${bookingSlug}`;
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Welcome to Nesema, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">We're delighted to have you here. Your profile is under review — we'll notify you once verification is complete, usually within 1–2 business days.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#5C5248;">Your booking link:</p>
    <p style="margin:0 0 24px;font-size:14px;color:#4E7A5F;font-weight:600;">${bookingUrl}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#5C5248;line-height:1.6;">In the meantime, you can set up your availability, build out your profile, and explore the toolkit.</p>
    ${ctaButton("Go to your dashboard", `${APP_URL}/practitioner/dashboard`)}
  `;
  return resend.emails.send({ from: FROM, to, subject: `Welcome to Nesema, ${firstName}`, html: emailTemplate(content) });
}

// ─── Welcome — Patient ──────────────────────────────────────────────────────
export async function sendPatientWelcome({
  to,
  firstName,
  practitionerName,
  bookingSlug,
}: {
  to: string;
  firstName: string;
  practitionerName: string;
  bookingSlug: string;
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">You're all set, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">Your account is ready. ${practitionerName} is looking forward to working with you on your health journey.</p>
    ${ctaButton("Book your first session", `${APP_URL}/book/${bookingSlug}`)}
  `;
  return resend.emails.send({ from: FROM, to, subject: `You're all set, ${firstName}`, html: emailTemplate(content) });
}

// ─── Booking confirmation — Patient ─────────────────────────────────────────
export async function sendBookingConfirmationPatient({
  to,
  patientName,
  practitionerName,
  appointmentDate,
  appointmentTime,
  sessionType,
  amountPence,
  cancellationHours,
  appointmentId,
}: {
  to: string;
  patientName: string;
  practitionerName: string;
  appointmentDate: string;
  appointmentTime: string;
  sessionType: string;
  amountPence: number;
  cancellationHours: number;
  appointmentId: string;
}) {
  const googleCalUrl = buildGoogleCalUrl({ practitionerName, appointmentId });
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Your session is confirmed.</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#5C5248;line-height:1.6;">Hi ${patientName}, your booking with ${practitionerName} has been confirmed.</p>
    <table width="100%" style="border-top:1px solid #E6E0D8;border-bottom:1px solid #E6E0D8;padding:16px 0;margin-bottom:24px;font-size:14px;color:#5C5248;">
      <tr><td style="padding:6px 0;color:#9C9087;width:40%;">Date</td><td>${appointmentDate}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Time</td><td>${appointmentTime}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Session type</td><td>${sessionType}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Amount paid</td><td>£${(amountPence / 100).toFixed(2)}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Cancellation</td><td>${cancellationHours}h notice required</td></tr>
    </table>
    ${ctaButton("Add to Google Calendar", googleCalUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#9C9087;">Your session link will be available in the app.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your session with ${practitionerName} is confirmed`,
    html: emailTemplate(content),
  });
}

// ─── Booking notification — Practitioner ────────────────────────────────────
export async function sendBookingNotificationPractitioner({
  to,
  practitionerName,
  patientName,
  appointmentDate,
  appointmentTime,
  sessionType,
}: {
  to: string;
  practitionerName: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  sessionType: string;
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">New booking from ${patientName}.</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#5C5248;line-height:1.6;">Hi ${practitionerName}, a new session has been booked.</p>
    <table width="100%" style="border-top:1px solid #E6E0D8;border-bottom:1px solid #E6E0D8;padding:16px 0;margin-bottom:24px;font-size:14px;color:#5C5248;">
      <tr><td style="padding:6px 0;color:#9C9087;width:40%;">Patient</td><td>${patientName}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Session type</td><td>${sessionType}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Date</td><td>${appointmentDate}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Time</td><td>${appointmentTime}</td></tr>
    </table>
    ${ctaButton("View calendar", `${APP_URL}/practitioner/calendar`)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `New booking from ${patientName}`,
    html: emailTemplate(content),
  });
}

// ─── Appointment reminder — both ─────────────────────────────────────────────
export async function sendAppointmentReminder({
  to,
  recipientName,
  otherPartyName,
  appointmentDate,
  appointmentTime,
  appointmentId,
  role,
}: {
  to: string;
  recipientName: string;
  otherPartyName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentId: string;
  role: "patient" | "practitioner";
}) {
  const joinUrl = role === "patient"
    ? `${APP_URL}/patient/session?appointmentId=${appointmentId}`
    : `${APP_URL}/practitioner/session?appointmentId=${appointmentId}`;
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Your session is tomorrow.</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#5C5248;line-height:1.6;">Hi ${recipientName}, a reminder that you have a session with ${otherPartyName} tomorrow.</p>
    <table width="100%" style="border-top:1px solid #E6E0D8;border-bottom:1px solid #E6E0D8;padding:16px 0;margin-bottom:24px;font-size:14px;color:#5C5248;">
      <tr><td style="padding:6px 0;color:#9C9087;width:40%;">Date</td><td>${appointmentDate}</td></tr>
      <tr><td style="padding:6px 0;color:#9C9087;">Time</td><td>${appointmentTime}</td></tr>
    </table>
    ${ctaButton("Join session", joinUrl)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your session tomorrow at ${appointmentTime}`,
    html: emailTemplate(content),
  });
}

// ─── Check-in streak alert — Practitioner ───────────────────────────────────
export async function sendCheckinStreakAlert({
  to,
  practitionerName,
  patientName,
  daysMissed,
  patientId,
}: {
  to: string;
  practitionerName: string;
  patientName: string;
  daysMissed: number;
  patientId: string;
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">${patientName} hasn't checked in recently.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">Hi ${practitionerName}, ${patientName} hasn't submitted a daily check-in in the last ${daysMissed} days. You may want to reach out.</p>
    ${ctaButton("View patient profile", `${APP_URL}/practitioner/patients/${patientId}`)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${patientName} hasn't checked in for ${daysMissed} days`,
    html: emailTemplate(content),
  });
}

// ─── Admin — Verified ────────────────────────────────────────────────────────
export async function sendPractitionerVerified({
  to,
  firstName,
}: {
  to: string;
  firstName: string;
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">You're verified, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">Great news — your Nesema profile has been reviewed and verified. You're now live on the platform and can start accepting bookings.</p>
    ${ctaButton("Go to your dashboard", `${APP_URL}/practitioner/dashboard`)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Your Nesema profile is now verified",
    html: emailTemplate(content),
  });
}

// ─── Admin — Rejected ────────────────────────────────────────────────────────
export async function sendPractitionerRejected({
  to,
  firstName,
  reason,
}: {
  to: string;
  firstName: string;
  reason: string;
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Application update, ${firstName}.</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#5C5248;line-height:1.6;">Thank you for applying to join Nesema. After reviewing your profile, we're unable to verify your registration at this time.</p>
    <table width="100%" style="border-left:3px solid #E6E0D8;padding:12px 16px;margin-bottom:20px;background:#F9F6F2;border-radius:0 8px 8px 0;">
      <tr><td style="font-size:14px;color:#5C5248;line-height:1.6;">${reason}</td></tr>
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#5C5248;line-height:1.6;">If you believe this is an error or would like to provide additional information, please reply to this email.</p>
    ${ctaButton("Contact support", `mailto:support@nesema.com`)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: "An update on your Nesema application",
    html: emailTemplate(content),
  });
}

// ─── Admin — Suspended ───────────────────────────────────────────────────────
export async function sendAccountSuspended({
  to,
  firstName,
  role,
}: {
  to: string;
  firstName: string;
  role: "practitioner" | "patient";
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Account suspended, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">Your Nesema ${role} account has been suspended by our team. Access to the platform has been paused pending review.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#5C5248;line-height:1.6;">If you believe this is a mistake or wish to discuss this decision, please get in touch.</p>
    ${ctaButton("Contact support", `mailto:support@nesema.com`)}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Your Nesema account has been suspended",
    html: emailTemplate(content),
  });
}

// ─── Admin — Reinstated ──────────────────────────────────────────────────────
export async function sendAccountReinstated({
  to,
  firstName,
  role,
}: {
  to: string;
  firstName: string;
  role: "practitioner" | "patient";
}) {
  const content = `
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E1A16;">Welcome back, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5248;line-height:1.6;">Your Nesema ${role} account has been reinstated. You can now access all platform features as normal.</p>
    ${ctaButton(
      role === "practitioner" ? "Go to your dashboard" : "Go to the app",
      role === "practitioner" ? `${APP_URL}/practitioner/dashboard` : `${APP_URL}/patient/dashboard`
    )}
  `;
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Your Nesema account has been reinstated",
    html: emailTemplate(content),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildGoogleCalUrl({
  practitionerName,
  appointmentId,
}: {
  practitionerName: string;
  appointmentId: string;
}) {
  const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(`Session with ${practitionerName} — Nesema`);
  const details = encodeURIComponent(`Join your session: ${APP_URL}/patient/session?appointmentId=${appointmentId}`);
  return `${baseUrl}&text=${title}&details=${details}`;
}

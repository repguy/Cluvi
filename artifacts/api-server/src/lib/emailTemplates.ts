const BRAND_COLOR = "#6C63FF";
const BRAND_DARK = "#1A1A2E";

function base(content: string, previewText = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
${previewText ? `<meta name="description" content="${previewText}"/>` : ""}
<title>Cluvi</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:${BRAND_DARK};border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
            <span style="color:${BRAND_COLOR};">●</span> Cluvi
          </span>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:32px;border-left:1px solid #e8e8f0;border-right:1px solid #e8e8f0;">
          ${content}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f8f8fc;border:1px solid #e8e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Sent by Cluvi · Your business, always on.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;background:#f8f8fc;border-radius:6px;font-size:12px;color:#64748b;width:110px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0 8px 12px;font-size:14px;color:${BRAND_DARK};font-weight:600;vertical-align:top;">${value || "—"}</td>
  </tr>
  <tr><td colspan="2" style="height:4px;"></td></tr>`;
}

function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${color};background:${bg};letter-spacing:0.3px;">${text}</span>`;
}

export interface OwnerBookingEmailOptions {
  businessName: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  date: string;
  timePreference: string;
  isAfterHours: boolean;
}

export function ownerBookingEmail(o: OwnerBookingEmailOptions): string {
  const afterHours = o.isAfterHours;
  const headline = afterHours ? "After-Hours Lead" : "New Booking";
  const intro = afterHours
    ? `Someone reached out to <b>${o.businessName}</b> outside of office hours and left their details.`
    : `A new appointment has been booked at <b>${o.businessName}</b>.`;

  const content = `
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;text-transform:uppercase;">${afterHours ? "🌙 After Hours" : "📅 New Booking"}</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND_DARK};">${headline}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">${intro}</p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      ${row("Name", o.name)}
      ${row("Phone", o.phone)}
      ${o.email ? row("Email", o.email) : ""}
      ${row(afterHours ? "Reason" : "Service", o.service)}
      ${!afterHours ? row("Date", o.date) : ""}
      ${!afterHours ? row("Time", o.timePreference) : ""}
    </table>

    ${afterHours
      ? `<div style="background:#ede9fe;border-left:4px solid ${BRAND_COLOR};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:0;">
          <p style="margin:0;font-size:13px;color:#4c1d95;font-weight:600;">This is an after-hours lead — please follow up when you're open.</p>
        </div>`
      : `<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:0;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">A customer is expecting a confirmation call soon.</p>
        </div>`
    }
  `;
  return base(content, `${headline} at ${o.businessName}`);
}

export interface CustomerConfirmationEmailOptions {
  businessName: string;
  name: string;
  phone: string;
  service: string;
  date: string;
  timePreference: string;
}

export function customerConfirmationEmail(o: CustomerConfirmationEmailOptions): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;width:56px;height:56px;background:#f0fdf4;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${BRAND_DARK};">You're booked!</h1>
      <p style="margin:0;font-size:15px;color:#64748b;">Hi ${o.name}, your appointment at <b>${o.businessName}</b> has been received.</p>
    </div>

    <div style="background:#fafafa;border:1px solid #e8e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row("Service", o.service)}
        ${row("Date", o.date)}
        ${row("Time", o.timePreference)}
        ${row("Phone", o.phone)}
      </table>
    </div>

    <p style="margin:0 0 0;font-size:14px;color:#64748b;line-height:1.6;text-align:center;">
      We'll reach out soon to confirm everything. See you then!<br/>
      <b style="color:${BRAND_DARK};">— The ${o.businessName} Team</b>
    </p>
  `;
  return base(content, `Your booking at ${o.businessName} is confirmed`);
}

export function testEmailTemplate(botName: string): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:12px;">🎉</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:${BRAND_DARK};">Email notifications are working!</h1>
      <p style="margin:0;font-size:15px;color:#64748b;">This test was sent from your Cluvi bot <b>${botName}</b>.</p>
    </div>
    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:18px 20px;margin-bottom:0;">
      <p style="margin:0;font-size:14px;color:#3730a3;line-height:1.6;">
        ✅ Your Resend API key is configured correctly.<br/>
        ✅ Booking notifications will be sent to this address.<br/>
        ✅ Customers will receive a confirmation email after booking.
      </p>
    </div>
  `;
  return base(content, `Test email from ${botName}`);
}

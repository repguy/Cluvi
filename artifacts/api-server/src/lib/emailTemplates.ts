const BRAND_DARK = "#1A1A2E";

interface BusinessTheme {
  accent: string;
  accentLight: string;
  accentText: string;
  icon: string;
  noun: string;
  nounCap: string;
  serviceLabel: string;
  ownerCta: string;
  ownerCtaColor: string;
  ownerCtaBg: string;
  customerHeadline: string;
  customerSubtitle: string;
  customerEmoji: string;
}

function getTheme(businessType: string): BusinessTheme {
  const t = (businessType || "").toLowerCase();

  if (t.includes("restaurant") || t.includes("dining") || t.includes("cafe") || t.includes("bistro")) {
    return {
      accent: "#f97316", accentLight: "#fff7ed", accentText: "#7c2d12",
      icon: "🍽️", noun: "reservation", nounCap: "Reservation",
      serviceLabel: "Occasion",
      ownerCta: "Prepare the table and confirm with the guest.",
      ownerCtaColor: "#7c2d12", ownerCtaBg: "#fff7ed",
      customerHeadline: "Reservation confirmed!", customerEmoji: "🍽️",
      customerSubtitle: "Your table is reserved. We look forward to welcoming you!",
    };
  }
  if (t.includes("salon") || t.includes("spa") || t.includes("beauty") || t.includes("hair")) {
    return {
      accent: "#ec4899", accentLight: "#fdf2f8", accentText: "#831843",
      icon: "✂️", noun: "appointment", nounCap: "Appointment",
      serviceLabel: "Service",
      ownerCta: "Prepare for their visit and reach out to confirm.",
      ownerCtaColor: "#831843", ownerCtaBg: "#fdf2f8",
      customerHeadline: "You're all booked in!", customerEmoji: "✨",
      customerSubtitle: "We can't wait to pamper you. See you soon!",
    };
  }
  if (t.includes("gym") || t.includes("fitness") || t.includes("studio") || t.includes("pilates") || t.includes("yoga")) {
    return {
      accent: "#22c55e", accentLight: "#f0fdf4", accentText: "#166534",
      icon: "💪", noun: "session", nounCap: "Session",
      serviceLabel: "Class / Session",
      ownerCta: "Add them to the class roster and confirm their spot.",
      ownerCtaColor: "#166534", ownerCtaBg: "#f0fdf4",
      customerHeadline: "You're in — let's go!", customerEmoji: "💪",
      customerSubtitle: "Your session is booked. Get ready to crush it!",
    };
  }
  if (t.includes("law") || t.includes("attorney") || t.includes("legal") || t.includes("solicitor")) {
    return {
      accent: "#1e40af", accentLight: "#eff6ff", accentText: "#1e3a8a",
      icon: "⚖️", noun: "consultation", nounCap: "Consultation",
      serviceLabel: "Consultation Type",
      ownerCta: "Review their case details and prepare for the consultation.",
      ownerCtaColor: "#1e3a8a", ownerCtaBg: "#eff6ff",
      customerHeadline: "Consultation scheduled!", customerEmoji: "⚖️",
      customerSubtitle: "Our team will review your details and be in touch to confirm.",
    };
  }
  if (t.includes("real estate") || t.includes("realty") || t.includes("property") || t.includes("realtor")) {
    return {
      accent: "#0891b2", accentLight: "#ecfeff", accentText: "#164e63",
      icon: "🏠", noun: "viewing", nounCap: "Viewing",
      serviceLabel: "Property / Service",
      ownerCta: "Prepare for the showing and follow up with the client.",
      ownerCtaColor: "#164e63", ownerCtaBg: "#ecfeff",
      customerHeadline: "Viewing confirmed!", customerEmoji: "🏠",
      customerSubtitle: "We'll be in touch shortly to confirm the property details.",
    };
  }
  if (t.includes("dental") || t.includes("dentist") || t.includes("orthodon")) {
    return {
      accent: "#06b6d4", accentLight: "#ecfeff", accentText: "#164e63",
      icon: "🦷", noun: "appointment", nounCap: "Appointment",
      serviceLabel: "Treatment",
      ownerCta: "Schedule the chair and confirm with the patient.",
      ownerCtaColor: "#164e63", ownerCtaBg: "#ecfeff",
      customerHeadline: "Appointment booked!", customerEmoji: "🦷",
      customerSubtitle: "We'll reach out to confirm. Don't forget to brush! 😄",
    };
  }
  if (t.includes("medical") || t.includes("clinic") || t.includes("practice") || t.includes("health") || t.includes("doctor")) {
    return {
      accent: "#3b82f6", accentLight: "#eff6ff", accentText: "#1e3a8a",
      icon: "🏥", noun: "appointment", nounCap: "Appointment",
      serviceLabel: "Reason for Visit",
      ownerCta: "Add to the patient schedule and confirm via phone.",
      ownerCtaColor: "#1e3a8a", ownerCtaBg: "#eff6ff",
      customerHeadline: "Appointment confirmed!", customerEmoji: "🏥",
      customerSubtitle: "We'll be in touch to confirm your slot. See you soon!",
    };
  }

  return {
    accent: "#6C63FF", accentLight: "#f0f0ff", accentText: "#312e81",
    icon: "📅", noun: "appointment", nounCap: "Appointment",
    serviceLabel: "Service",
    ownerCta: "A customer is expecting a confirmation call soon.",
    ownerCtaColor: "#312e81", ownerCtaBg: "#f0f0ff",
    customerHeadline: "You're booked!", customerEmoji: "✅",
    customerSubtitle: "We'll reach out soon to confirm everything. See you then!",
  };
}

function base(content: string, accentColor: string, previewText = ""): string {
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
            <span style="color:${accentColor};">●</span> Cluvi
          </span>
        </td>
      </tr>
      <!-- Accent bar -->
      <tr><td style="height:4px;background:${accentColor};"></td></tr>
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

function row(label: string, value: string, accentColor: string): string {
  return `<tr>
    <td style="padding:8px 12px;background:#f8f8fc;border-radius:6px;font-size:12px;color:#64748b;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0 8px 12px;font-size:14px;color:${BRAND_DARK};font-weight:600;vertical-align:top;">${value || "—"}</td>
  </tr>
  <tr><td colspan="2" style="height:4px;"></td></tr>`;
}

export interface OwnerBookingEmailOptions {
  businessName: string;
  businessType: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  date: string;
  timePreference: string;
  isAfterHours: boolean;
}

export function ownerBookingEmail(o: OwnerBookingEmailOptions): string {
  const th = getTheme(o.businessType);
  const afterHours = o.isAfterHours;
  const headline = afterHours ? "After-Hours Lead" : `New ${th.nounCap}`;
  const intro = afterHours
    ? `Someone reached out to <b>${o.businessName}</b> outside of office hours and left their details.`
    : `A new ${th.noun} has been made at <b>${o.businessName}</b>.`;

  const content = `
    <div style="display:inline-block;padding:4px 12px;background:${th.accentLight};border-radius:20px;margin-bottom:14px;">
      <span style="font-size:12px;font-weight:700;color:${th.accentText};letter-spacing:0.4px;text-transform:uppercase;">${th.icon}&nbsp; ${afterHours ? "After Hours" : "New " + th.nounCap}</span>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND_DARK};">${headline}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">${intro}</p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      ${row("Name", o.name, th.accent)}
      ${row("Phone", o.phone, th.accent)}
      ${o.email ? row("Email", o.email, th.accent) : ""}
      ${row(afterHours ? "Reason" : th.serviceLabel, o.service, th.accent)}
      ${!afterHours ? row("Date", o.date, th.accent) : ""}
      ${!afterHours ? row("Time", o.timePreference, th.accent) : ""}
    </table>

    <div style="background:${th.accentLight};border-left:4px solid ${th.accent};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:0;">
      <p style="margin:0;font-size:13px;color:${th.accentText};font-weight:600;">
        ${afterHours ? "This is an after-hours lead — please follow up when you're open." : th.ownerCta}
      </p>
    </div>
  `;
  return base(content, th.accent, `${headline} at ${o.businessName}`);
}

export interface CustomerConfirmationEmailOptions {
  businessName: string;
  businessType: string;
  name: string;
  phone: string;
  service: string;
  date: string;
  timePreference: string;
}

export function customerConfirmationEmail(o: CustomerConfirmationEmailOptions): string {
  const th = getTheme(o.businessType);

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;width:64px;height:64px;background:${th.accentLight};border-radius:50%;line-height:64px;font-size:32px;margin-bottom:12px;">${th.customerEmoji}</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${BRAND_DARK};">${th.customerHeadline}</h1>
      <p style="margin:0;font-size:15px;color:#64748b;">Hi <b>${o.name}</b>, your ${th.noun} at <b>${o.businessName}</b> has been received.</p>
    </div>

    <div style="background:#fafafa;border:1px solid #e8e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${th.nounCap} Details</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row(th.serviceLabel, o.service, th.accent)}
        ${row("Date", o.date, th.accent)}
        ${row("Time", o.timePreference, th.accent)}
        ${row("Phone", o.phone, th.accent)}
      </table>
    </div>

    <div style="background:${th.accentLight};border-radius:10px;padding:16px 20px;margin-bottom:0;text-align:center;">
      <p style="margin:0;font-size:14px;color:${th.accentText};line-height:1.6;">
        ${th.customerSubtitle}<br/>
        <b>— The ${o.businessName} Team</b>
      </p>
    </div>
  `;
  return base(content, th.accent, `Your ${th.noun} at ${o.businessName} is confirmed`);
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
  return base(content, "#6C63FF", `Test email from ${botName}`);
}

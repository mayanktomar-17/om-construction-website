const express = require("express");
const brevo = require("@getbrevo/brevo");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: "Too many requests. Please try again after 15 minutes." }
});

function clean(value = "") {
  return String(value).trim().replace(/[<>]/g, "");
}

function nl2br(value = "") {
  return clean(value).replace(/\n/g, "<br>");
}

function buildInquiryEmail({ name, phone, email, subject, message }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;">
    <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0a1628;color:white;padding:22px 26px;">
        <h2 style="margin:0;font-size:22px;">New Inquiry from OM Construction Website</h2>
        <p style="margin:6px 0 0;color:#cbd5e1;">A customer submitted the website contact form.</p>
      </div>
      <div style="padding:24px 26px;color:#111827;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:10px;border-bottom:1px solid #eef2f7;font-weight:bold;width:140px;">Name</td><td style="padding:10px;border-bottom:1px solid #eef2f7;">${name}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eef2f7;font-weight:bold;">Phone</td><td style="padding:10px;border-bottom:1px solid #eef2f7;"><a href="tel:${phone}" style="color:#2563eb;">${phone}</a></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eef2f7;font-weight:bold;">Email</td><td style="padding:10px;border-bottom:1px solid #eef2f7;"><a href="mailto:${email}" style="color:#2563eb;">${email}</a></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eef2f7;font-weight:bold;">Service</td><td style="padding:10px;border-bottom:1px solid #eef2f7;">${subject}</td></tr>
        </table>
        <h3 style="margin:22px 0 8px;color:#0a1628;">Project Requirement</h3>
        <div style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:10px;padding:14px 16px;line-height:1.6;">${nl2br(message)}</div>
        <p style="margin:22px 0 0;color:#64748b;font-size:13px;">Tip: Click Reply to respond directly to the customer.</p>
      </div>
    </div>
  </div>`;
}

function buildAutoReply({ name }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;">
    <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0a1628;color:white;padding:22px 26px;">
        <h2 style="margin:0;font-size:22px;">Thank you for contacting OM Construction</h2>
      </div>
      <div style="padding:24px 26px;color:#111827;line-height:1.7;">
        <p>Hi ${name},</p>
        <p>We have received your inquiry. Our team will review your requirement and contact you soon.</p>
        <p><b>OM Construction</b><br/>Engineering & Industrial Solutions</p>
        <p style="color:#64748b;font-size:13px;">This is an automatic confirmation email.</p>
      </div>
    </div>
  </div>`;
}

app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const name = clean(req.body.name);
    const phone = clean(req.body.phone);
    const email = clean(req.body.email);
    const subject = clean(req.body.subject);
    const message = clean(req.body.message);

    if (!name || !phone || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    if (!process.env.EMAIL_USER || !process.env.BREVO_API_KEY) {
  console.error("Missing EMAIL_USER or BREVO_API_KEY in .env");
  return res.status(500).json({ success: false, message: "Email service is not configured." });
} 

   const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);
    const toEmail = process.env.CLIENT_EMAIL || process.env.EMAIL_USER;
    const inquiry = { name, phone, email, subject, message };

   await apiInstance.sendTransacEmail({
  sender: {
    name: "OM Construction Website",
    email: process.env.EMAIL_USER
  },
  to: [{ email: toEmail }],
  replyTo: { email: email },
  subject: `New Inquiry from OM Construction Website - ${subject}`,
  htmlContent: buildInquiryEmail(inquiry)
});
   await apiInstance.sendTransacEmail({
  sender: {
    name: "OM Construction",
    email: process.env.EMAIL_USER
  },
  to: [{ email: email }],
  subject: "Thank you for contacting OM Construction",
  htmlContent: buildAutoReply({ name })
});
    console.log("Mail sent:", { name, phone, email, subject });
    return res.json({ success: true, message: "Inquiry sent successfully. We will contact you soon." });
  } catch (error) {
    console.error("Mail error:", error.message);
    return res.status(500).json({ success: false, message: "Email could not be sent. Please try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`OM Construction website running on http://localhost:${PORT}`);
});

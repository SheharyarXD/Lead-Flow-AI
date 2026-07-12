import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || "587");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.SMTP_FROM_EMAIL || "no-reply@leadflowai.com";

let transporter: nodemailer.Transporter | null = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for port 465, false for others
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  console.log("Nodemailer SMTP Transporter initialized successfully.");
} else {
  console.warn("WARNING: SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are missing. Email sending will be simulated.");
}

export async function sendEmail(to: string, subject: string, body: string) {
  if (!transporter) {
    console.warn(`Email not sent: SMTP is not configured (development mode). Recipient: ${to}`);
    return { messageId: null, status: "development_not_sent" as const };
  }

  try {
    const info = await transporter.sendMail({
      from: `"LeadFlow AI" <${fromEmail}>`,
      to,
      subject: subject || "Update from LeadFlow AI",
      text: body,
    });
    console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Failed to send Email via Nodemailer to ${to}:`, error);
    throw error;
  }
}

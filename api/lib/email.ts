import nodemailer from "nodemailer";

export async function sendEmail(
  to: string, 
  subject: string, 
  body: string, 
  credentials?: { 
    host?: string | null; 
    port?: number | null; 
    user?: string | null; 
    pass?: string | null; 
    fromEmail?: string | null; 
  }
) {
  const host = credentials?.host || process.env.SMTP_HOST;
  const port = credentials?.port || parseInt(process.env.SMTP_PORT || "587");
  const user = credentials?.user || process.env.SMTP_USER;
  const pass = credentials?.pass || process.env.SMTP_PASS;
  const fromEmail = credentials?.fromEmail || process.env.SMTP_FROM_EMAIL || "no-reply@leadflowai.com";

  if (!host || !user || !pass) {
    console.warn(`Email not sent: SMTP is not configured (development mode). Recipient: ${to}`);
    return { messageId: null, status: "development_not_sent" as const };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

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

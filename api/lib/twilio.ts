import twilio from "twilio";

export async function sendSMS(
  to: string, 
  body: string, 
  credentials?: { 
    accountSid?: string | null; 
    authToken?: string | null; 
    phoneNumber?: string | null; 
  }
) {
  const sid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = credentials?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn(`SMS not sent: Twilio is not configured (development mode). Recipient: ${to}`);
    return { sid: null, status: "development_not_sent" as const };
  }

  try {
    const client = twilio(sid, token);
    const message = await client.messages.create({
      body,
      from,
      to,
    });
    console.log(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`Failed to send SMS via Twilio to ${to}:`, error);
    throw error;
  }
}

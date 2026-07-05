import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
  console.log("Twilio SMS Client initialized successfully.");
} else {
  console.warn("WARNING: Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing. SMS sending will be simulated.");
}

export async function sendSMS(to: string, body: string) {
  if (!twilioClient || !fromPhone) {
    console.log(`[SIMULATED SMS] TO: ${to} | BODY: ${body}`);
    return { sid: "simulated_sms_sid", status: "queued" };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      from: fromPhone,
      to,
    });
    console.log(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`Failed to send SMS via Twilio to ${to}:`, error);
    throw error;
  }
}

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
    console.error("Error sending SMS via Twilio:", error);
    throw error;
  }
}

export async function generateTwilioVoiceToken(
  identity: string,
  credentials?: {
    accountSid?: string | null;
    authToken?: string | null;
    twimlAppSid?: string | null;
  }
) {
  const sid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN;
  // A BYOK org's own TwiML App only exists in their own Twilio account, so
  // only the platform-wide App SID is a valid fallback when the org is using
  // the platform's shared Twilio account (i.e. no org-level accountSid set).
  const twimlAppSid = credentials?.twimlAppSid || (!credentials?.accountSid ? process.env.TWILIO_TWIML_APP_SID : null);

  if (!sid || !token || !twimlAppSid) {
    return {
      token: `mock_voice_token_${identity}_${Date.now()}`,
      identity,
      simulated: true as const,
      reason: !sid || !token ? "Twilio account credentials are not configured" : "No TwiML Application SID is configured for outbound browser calling",
    };
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const accessToken = new AccessToken(sid, token, token, { identity });
  accessToken.addGrant(voiceGrant);

  return { token: accessToken.toJwt(), identity, simulated: false as const };
}

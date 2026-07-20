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
  }
) {
  const sid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID || "APmock_app_sid";

  if (!sid || !token) {
    return { token: `mock_voice_token_${identity}_${Date.now()}`, identity };
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const accessToken = new AccessToken(sid, token, token, { identity });
  accessToken.addGrant(voiceGrant);

  return { token: accessToken.toJwt(), identity };
}

export async function createTwilioCall(
  to: string,
  statusCallbackUrl: string,
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
    console.warn(`Call initiated in development simulation mode for ${to}`);
    return { sid: `CA_mock_${Date.now()}`, status: "queued" as const };
  }

  const client = twilio(sid, token);
  const call = await client.calls.create({
    to,
    from,
    url: `${statusCallbackUrl}/api/webhooks/voice`,
    statusCallback: `${statusCallbackUrl}/api/webhooks/voice/status`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    record: true,
    recordingStatusCallback: `${statusCallbackUrl}/api/webhooks/voice/recording`,
  });

  return call;
}

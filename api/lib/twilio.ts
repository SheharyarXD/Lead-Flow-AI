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

export interface TwilioVoiceCredentials {
  accountSid?: string | null;
  authToken?: string | null;
  phoneNumber?: string | null;
  twimlAppSid?: string | null;
  // org.phone — a fallback caller ID for orgs that never separately set a
  // dedicated Twilio number but do have a general business phone on file.
  organizationPhone?: string | null;
}

export interface TwilioCallConfigResult {
  accountSid: string | null;
  authToken: string | null;
  phoneNumber: string | null;
  twimlAppSid: string | null;
  isConfigured: boolean;
  // Set whenever isConfigured is false — the specific missing piece, so a
  // caller (generateVoiceToken's "reason" field, initiateCall's activity log)
  // can say exactly what's blocking real outbound calling instead of a bare
  // yes/no.
  reason: string | null;
}

// The one place "is real outbound Voice SDK calling available for this org"
// gets decided — generateTwilioVoiceToken (issues the browser's WebRTC token)
// and callRouter.initiateCall (decides whether to label a call `simulated`)
// both call this, so they can never disagree about it. Before this,
// initiateCall had its own local check that only looked at accountSid/
// authToken/phoneNumber on the org row directly — no platform-env fallback
// (unlike sendSMS and generateTwilioVoiceToken) and, more importantly, no
// twimlAppSid check at all, so it could call a setup "configured" that
// generateVoiceToken would separately still refuse to issue a real token for.
//
// sendSMS intentionally does NOT share this resolver: sending a text has no
// TwiML Application concept at all, so it only ever needs
// {accountSid, authToken, phoneNumber} — folding it into this Voice-specific
// resolver would incorrectly start requiring a TwiML App SID for SMS too.
export function resolveTwilioCallConfig(credentials?: TwilioVoiceCredentials): TwilioCallConfigResult {
  const accountSid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID || null;
  const authToken = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN || null;
  const phoneNumber = credentials?.phoneNumber || credentials?.organizationPhone || process.env.TWILIO_PHONE_NUMBER || null;
  // A BYOK org's own TwiML App only exists in their own Twilio account, so
  // only the platform-wide App SID is a valid fallback when the org is using
  // the platform's shared Twilio account (i.e. no org-level accountSid set).
  const twimlAppSid = credentials?.twimlAppSid || (!credentials?.accountSid ? process.env.TWILIO_TWIML_APP_SID : null) || null;

  if (!accountSid || !authToken) {
    return { accountSid, authToken, phoneNumber, twimlAppSid, isConfigured: false, reason: "Twilio account credentials are not configured" };
  }
  if (!twimlAppSid) {
    return { accountSid, authToken, phoneNumber, twimlAppSid, isConfigured: false, reason: "No TwiML Application SID is configured for outbound browser calling" };
  }
  if (!phoneNumber) {
    return { accountSid, authToken, phoneNumber, twimlAppSid, isConfigured: false, reason: "No caller-ID phone number is configured" };
  }
  return { accountSid, authToken, phoneNumber, twimlAppSid, isConfigured: true, reason: null };
}

export async function generateTwilioVoiceToken(identity: string, credentials?: TwilioVoiceCredentials) {
  const config = resolveTwilioCallConfig(credentials);

  if (!config.isConfigured) {
    return {
      token: `mock_voice_token_${identity}_${Date.now()}`,
      identity,
      simulated: true as const,
      reason: config.reason,
    };
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: config.twimlAppSid!,
    incomingAllow: true,
  });

  const accessToken = new AccessToken(config.accountSid!, config.authToken!, config.authToken!, { identity });
  accessToken.addGrant(voiceGrant);

  return { token: accessToken.toJwt(), identity, simulated: false as const };
}

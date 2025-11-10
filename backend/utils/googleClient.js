// backend/utils/googleClient.js
import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";

const oauth2ClientFactory = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

/**
 * Get an authorized OAuth2 client for a specific connected account (by email).
 * Automatically refreshes access token using refresh_token, and saves updated tokens.
 */
export async function getAuthorizedClientForAccount(accountEmail, userId) {
  const account = await EmailAccount.findOne({ userId, email: accountEmail });
  if (!account) throw new Error("Email account not found for user");

  const oauth2Client = oauth2ClientFactory();

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  // If token expiry missing or in the past, refresh
  const now = Date.now();
  if (!account.accessToken || !account.tokenExpiry || now >= new Date(account.tokenExpiry).getTime()) {
    try {
      // google-auth-library provides getAccessToken/refreshToken flows
      const res = await oauth2Client.refreshAccessToken();
      const newTokens = res.credentials || {};
      if (newTokens.access_token) {
        account.accessToken = newTokens.access_token;
        if (newTokens.expiry_date) account.tokenExpiry = new Date(newTokens.expiry_date);
        await account.save();
        oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
      }
    } catch (err) {
      console.error("Failed to refresh access token:", err?.message || err);
      // bubble up; caller will handle
      throw new Error("Failed to refresh access token");
    }
  }

  return oauth2Client;
}

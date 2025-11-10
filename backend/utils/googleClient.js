import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";

export async function getAuthorizedClient(userEmail) {
  const account = await EmailAccount.findOne({ email: userEmail });
  if (!account) throw new Error("Account not found");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  // Refresh if token expired
  if (!account.accessToken || new Date() > account.tokenExpiry) {
    const newTokens = await oauth2Client.refreshAccessToken();
    const { access_token, expiry_date } = newTokens.credentials;

    account.accessToken = access_token;
    account.tokenExpiry = new Date(expiry_date);
    await account.save();
    oauth2Client.setCredentials({ access_token });
  }

  return oauth2Client;
}

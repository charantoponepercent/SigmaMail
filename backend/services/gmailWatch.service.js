import { google } from "googleapis";

export async function startGmailWatch(account) {
  const topicName = (process.env.GOOGLE_PUBSUB_TOPIC || "").trim();
  if (!topicName) {
    throw new Error(
      "GOOGLE_PUBSUB_TOPIC is required to register Gmail push watch."
    );
  }

  const oauth2Client = new google.auth.OAuth2();

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
    },
  });

  return {
    historyId: res.data.historyId,
    expiration: res.data.expiration,
  };
}

import { google } from "googleapis";

export async function startGmailWatch(account) {
  const oauth2Client = new google.auth.OAuth2();

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/gen-lang-client-0963198730/topics/gmail-push",
      labelIds: ["INBOX"],
    },
  });

  return {
    historyId: res.data.historyId,
    expiration: res.data.expiration,
  };
}
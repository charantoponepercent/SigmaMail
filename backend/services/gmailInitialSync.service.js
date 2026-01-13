import { google } from "googleapis";
import EmailAccount from "../models/EmailAccount.js";
import { getAuthorizedClientForAccount } from "../utils/googleClient.js";
import { Queue } from "bullmq";
import { redis } from "../utils/redis.js";

const messageSyncQueue = new Queue("gmail-message-sync", {
  connection: redis,
});

const INITIAL_LIMIT = 120;

export async function runInitialSync(accountId) {
  const account = await EmailAccount.findById(accountId);
  if (!account || account.initialSyncDone) return;

  const authClient = await getAuthorizedClientForAccount(
    account.email,
    account.userId
  );

  const gmail = google.gmail({ version: "v1", auth: authClient });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: INITIAL_LIMIT,
  });

  const messageIds = (res.data.messages || []).map((m) => m.id);

  if (messageIds.length === 0) {
    account.initialSyncDone = true;
    await account.save();
    return;
  }

  // 🔥 Hand off to the worker from Step 2
  await messageSyncQueue.add(
    "sync-messages",
    {
      accountId: account._id,
      messageIds,
    },
    {
      removeOnComplete: true,
    }
  );

  // Mark initial sync done (we don't block UI on processing)
  account.initialSyncDone = true;
  await account.save();
}
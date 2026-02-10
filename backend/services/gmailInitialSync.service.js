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
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10000,
      },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 500 },
    }
  );
}

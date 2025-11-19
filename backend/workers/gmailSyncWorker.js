// workers/gmailSyncWorker.js
// High-level implementation of Gmail Sync Worker
// Runs periodically to fetch new emails from each connected account,
// parse them, store in Emails + update Threads.

import { google } from 'googleapis';
import EmailAccount from '../models/EmailAccount.js';
import Email from '../models/Email.js';
import Thread from '../models/Thread.js';
import { getAuthorizedClientForAccount } from '../utils/googleClient.js';
import { parsePayloadDeep, fixBase64, fetchAttachmentData } from '../utils/emailParser.js';

// Main Sync Function
export async function runGmailSyncForUser(userId) {
  const accounts = await EmailAccount.find({ userId });

  for (const account of accounts) {
    await syncAccount(account);
  }
}

async function syncAccount(account) {
  try {
    const authClient = await getAuthorizedClientForAccount(account.email, account.userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
    const msgs = list.data.messages || [];

    for (const m of msgs) {
      await syncSingleMessage(gmail, m.id, account);
    }
  } catch (err) {
    console.error('Sync error for account:', account.email, err);
  }
}

async function syncSingleMessage(gmail, messageId, account) {
  const exists = await Email.findOne({ messageId, accountId: account._id });
  if (exists) return; // avoid duplicates

  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const payload = full.data.payload || {};
  const { htmlBody, textBody, inlineParts, attachmentParts } = parsePayloadDeep(payload);

  // Process HTML (CID replacements)
  let finalHtml = htmlBody || '';
  for (const inline of inlineParts) {
    let base64 = inline.data ? fixBase64(inline.data) : null;
    if (!base64 && inline.attachmentId) {
      base64 = await fetchAttachmentData(gmail, messageId, inline.attachmentId);
    }
    if (base64) {
      const url = `data:${inline.mimeType};base64,${base64}`;
      finalHtml = finalHtml.replace(new RegExp(`cid:${inline.cid}`, 'g'), url);
    }
  }

  // Build Email Document
  const headers = payload.headers || [];
  const find = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';

  const composedBody = finalHtml || (textBody ? `<pre>${textBody}</pre>` : "");

  const emailDoc = await Email.create({
    userId: account.userId,
    accountId: account._id,
    messageId,
    threadId: full.data.threadId,
    subject: find('Subject'),
    from: find('From'),
    to: find('To'),
    date: new Date(find('Date')),
    textBody,
    htmlBodyRaw: htmlBody,
    htmlBodyProcessed: finalHtml,
    // `body` is the canonical rendered body used by the frontend ThreadViewer
    body: composedBody,
    inlineImages: inlineParts.map((i) => ({ cid: i.cid, mimeType: i.mimeType })),
    attachments: attachmentParts.map((a) => ({ filename: a.filename, mimeType: a.mimeType })),
    labelIds: full.data.labelIds || [],
    snippet: full.data.snippet || '',
    hasInlineImages: inlineParts.length > 0,
    hasAttachments: attachmentParts.length > 0,
  });

  await updateThread(account, emailDoc);
}

async function updateThread(account, emailDoc) {
  let thread = await Thread.findOne({ threadId: emailDoc.threadId, accountId: account._id });

  if (!thread) {
    await Thread.create({
      userId: account.userId,
      accountId: account._id,
      threadId: emailDoc.threadId,
      messageIds: [emailDoc.messageId],
      participants: [emailDoc.from, emailDoc.to],
      subject: emailDoc.subject,
      snippet: emailDoc.snippet,
      lastMessageDate: emailDoc.date,
    });
    return;
  }

  thread.messageIds.push(emailDoc.messageId);
  thread.lastMessageDate = emailDoc.date;
  thread.snippet = emailDoc.snippet;
  thread.participants = Array.from(new Set([...thread.participants, emailDoc.from, emailDoc.to]));

  await thread.save();
}

// workers/gmailSyncWorker.js

import { google } from 'googleapis';
import EmailAccount from '../models/EmailAccount.js';
import Email from '../models/Email.js';
import Thread from '../models/Thread.js';
import { getAuthorizedClientForAccount } from '../utils/googleClient.js';
import { parsePayloadDeep, fixBase64, fetchAttachmentData } from '../utils/emailParser.js';
import { generateEmbedding } from '../utils/embedding.js';
import { classifyEmailFull } from "../classification/classificationEngine.js";
import cloudinary from '../config/cloudinary.js';
import { inboxEvents } from "../events/inboxEvents.js";
import { evaluateActions } from "../actions/index.js";

function buildHeaderMap(headers = []) {
  const map = {};
  for (const h of headers) {
    const key = (h?.name || "").trim();
    if (!key) continue;
    const value = (h?.value || "").trim();
    if (!map[key]) map[key] = value;
    else map[key] = `${map[key]}\n${value}`;
  }
  return map;
}

function getHeaderCaseInsensitive(headerMap = {}, key = "") {
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(headerMap || {})) {
    if (k.toLowerCase() === target) return v;
  }
  return "";
}

function extractEmail(value = "") {
  const angle = value.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const plain = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/);
  return plain?.[0] || "";
}

function deriveMailedBy(headerMap = {}) {
  const returnPath = getHeaderCaseInsensitive(headerMap, "Return-Path");
  const sender = getHeaderCaseInsensitive(headerMap, "Sender");
  const from = getHeaderCaseInsensitive(headerMap, "From");
  const auth = getHeaderCaseInsensitive(headerMap, "Authentication-Results");

  const fromAuth = auth.match(/smtp\.mailfrom=([^\s;]+)/i)?.[1];
  if (fromAuth) return fromAuth.replace(/[<>]/g, "");

  return (
    extractEmail(returnPath) ||
    extractEmail(sender) ||
    extractEmail(from) ||
    ""
  );
}

function deriveSignedBy(headerMap = {}) {
  const auth = getHeaderCaseInsensitive(headerMap, "Authentication-Results");
  const dkim = getHeaderCaseInsensitive(headerMap, "DKIM-Signature");

  const headerD = auth.match(/header\.d=([^\s;]+)/i)?.[1];
  if (headerD) return headerD.replace(/[<>]/g, "");

  const headerI = auth.match(/header\.i=@([^\s;]+)/i)?.[1];
  if (headerI) return headerI.replace(/[<>]/g, "");

  const dkimD = dkim.match(/\bd=([a-z0-9.-]+\.[a-z]{2,})/i)?.[1];
  if (dkimD) return dkimD.toLowerCase();

  return "";
}

function deriveSecurity(headerMap = {}) {
  const auth = [
    getHeaderCaseInsensitive(headerMap, "Authentication-Results"),
    getHeaderCaseInsensitive(headerMap, "ARC-Authentication-Results"),
  ]
    .join(" ")
    .toLowerCase();
  const received = getHeaderCaseInsensitive(headerMap, "Received").toLowerCase();
  const transportBlob = `${auth} ${received}`;

  if (/tls|ssl|esmtps/.test(transportBlob)) {
    return "Standard encryption (TLS)";
  }

  if (/dkim=pass|spf=pass|dmarc=pass/.test(auth)) {
    return "Authenticated";
  }

  return "—";
}

function buildDeliveryMetadata(headerMap = {}) {
  return {
    replyTo: getHeaderCaseInsensitive(headerMap, "Reply-To") || "",
    mailedBy: deriveMailedBy(headerMap) || "",
    signedBy: deriveSignedBy(headerMap) || "",
    security: deriveSecurity(headerMap),
  };
}

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

export async function syncSingleMessage(gmail, messageId, account) {
  console.log("📩 syncSingleMessage START:", messageId);
  
  // Use upsert to avoid duplicates in race conditions
  const emailFilter = { messageId, accountId: account._id };
  const existed = await Email.exists(emailFilter);

  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const labels = full.data.labelIds || [];
  const isRead = !labels.includes("UNREAD");
  const payload = full.data.payload || {};
  
  // 1. Parse Body
  const { htmlBody, textBody, inlineParts, attachmentParts } = parsePayloadDeep(payload);

  // 2. Process HTML Inline Images (CID replacement)
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

  // 3. Extract Headers & Directionality
  const headers = payload.headers || [];
  const find = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
  const headerMap = buildHeaderMap(headers);
  const deliveryMeta = buildDeliveryMetadata(headerMap);
  const composedBody = finalHtml || (textBody ? `<pre>${textBody}</pre>` : "");

  const fromHeader = find("From") || "";
  // 🔥 FIX 1: Case-insensitive check to correctly identify incoming vs outgoing
  const isIncoming = !fromHeader.toLowerCase().includes(account.email.toLowerCase());

  // -------------------------------------------------------
  // CLOUDINARY ATTACHMENTS UPLOAD
  // -------------------------------------------------------
  const uploadedAttachments = [];

  for (const a of attachmentParts) {
    // Skip if not image, PDF, or Office doc
    const isImage = a.mimeType && a.mimeType.startsWith("image/");
    const isDoc = a.mimeType && (a.mimeType.includes("pdf") || a.mimeType.includes("msword") || a.mimeType.includes("officedocument"));

    if (!isImage && !isDoc) {
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,
      });
      continue;
    }

    let base64 = null;
    if (a.data) base64 = fixBase64(a.data);
    if (!base64 && a.attachmentId) {
      base64 = await fetchAttachmentData(gmail, messageId, a.attachmentId);
    }

    if (!base64) {
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,
      });
      continue;
    }

    const dataUrl = `data:${a.mimeType};base64,${base64}`;

    try {
      // Determine resource type: 'image' for images, 'raw' for PDFs/Docs
      const resourceType = isImage ? "image" : "raw";
      const options = {
        folder: "sigmamail/attachments",
        resource_type: resourceType,
        filename_override: a.filename,
      };

      // Only apply transformations to images
      if (isImage) {
        options.format = "jpg";
        options.transformation = [{ quality: "90" }];
        // clean filename extension for image replacement
        options.filename_override = a.filename.replace(/\.[^.]+$/, "") + ".jpg";
      }

      console.log(`⬆️ Uploading ${a.mimeType} to Cloudinary...`, a.filename);
      const uploadRes = await cloudinary.uploader.upload(dataUrl, options);

      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: uploadRes.bytes,
        storageUrl: uploadRes.secure_url,
      });

    } catch (err) {
      console.error("❌ Cloudinary upload failed:", err.message);
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,
      });
    }
  }

  // -------------------------------------------------------
  // DETECT EXTERNAL CLOUD ATTACHMENTS (Drive, Dropbox, etc)
  // -------------------------------------------------------
  const externalAttachments = [];
  const detectProvider = (url) => {
    if (/drive\.google\.com/.test(url)) return "drive";
    if (/dropbox\.com/.test(url)) return "dropbox";
    if (/onedrive\.live\.com/.test(url) || /1drv\.ms/.test(url)) return "onedrive";
    if (/icloud\.com/.test(url)) return "icloud";
    return "external";
  };

  const extractExternalLinks = (html, text) => {
    const results = [];
    const guessFilename = (url) => {
      try {
        const decoded = decodeURIComponent(url.split("?")[0]);
        const name = decoded.split("/").filter(Boolean).pop() || "document";
        return name.includes(".") ? name : name + ".pdf";
      } catch {
        return "file.pdf";
      }
    };
    const seen = new Set();
    const collect = (url) => {
      if (seen.has(url)) return;
      seen.add(url);
      results.push({
        filename: guessFilename(url),
        mimeType: "application/octet-stream",
        size: 0,
        storageUrl: url,
        isExternal: true,
        provider: detectProvider(url),
      });
    };

    const urlRegex = /(https?:\/\/(?:drive\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|icloud\.com)[^\s<>"']*)/gi;
    let match;
    // Scan text body
    while ((match = urlRegex.exec(text)) !== null) collect(match[1]);
    // Scan HTML body (simple regex, robust enough for links)
    while ((match = urlRegex.exec(html)) !== null) collect(match[1]);

    return results;
  };

  const cloudLinks = extractExternalLinks(finalHtml || "", textBody || "");
  if (cloudLinks.length > 0) externalAttachments.push(...cloudLinks);
  uploadedAttachments.push(...externalAttachments);

  // Dedup attachments
  const seenKeys = new Set();
  const deduped = [];
  for (const att of uploadedAttachments) {
    const key = att.storageUrl || att.filename;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(att);
  }
  
  // -------------------------------------------------------
  // EMBEDDING & CLASSIFICATION
  // -------------------------------------------------------
  const cleanedText = [
    find("Subject"),
    textBody || finalHtml.replace(/<[^>]+>/g, "")
  ].join("\n").trim();

  let embeddingVector = null;
  try {
    embeddingVector = await generateEmbedding(cleanedText);
  } catch (err) {
    console.error("❌ Embedding generation failed:", err.message);
  }

  let categoryResult = null;
  try {
    categoryResult = await classifyEmailFull({
      subject: find("Subject"),
      from: find("From"),
      text: composedBody,
      plainText: textBody || "",
      headers: headerMap,
      embedding: embeddingVector
    }, {
      userId: account.userId,
    });
  } catch (err) {
    console.error("❌ classifyEmailFull failed:", err);
  }

  // -------------------------------------------------------
  // SAVE TO DB
  // -------------------------------------------------------
  const emailDoc = await Email.findOneAndUpdate(
    emailFilter,
    {
      userId: account.userId,
      accountId: account._id,
      messageId,
      threadId: full.data.threadId,

      subject: find('Subject'),
      from: find('From'),
      to: find('To'),
      cc: find("Cc"),
      bcc: find("Bcc"),
      replyTo: deliveryMeta.replyTo,
      date: new Date(find('Date')),
      mailedBy: deliveryMeta.mailedBy,
      signedBy: deliveryMeta.signedBy,
      security: deliveryMeta.security,
      headers: headerMap,
      isIncoming,

      textBody,
      htmlBodyRaw: htmlBody,
      htmlBodyProcessed: finalHtml,
      body: composedBody,

      inlineImages: inlineParts.map((i) => ({
        cid: i.cid,
        mimeType: i.mimeType,
        size: 0,
        storageUrl: null,
      })),

      attachments: deduped,
      hasAttachments: deduped.length > 0,
      embedding: embeddingVector,

      labelIds: labels,
      isRead: isRead,

      snippet: full.data.snippet || '',
      hasInlineImages: inlineParts.length > 0,

      category: categoryResult?.top || null,
      categoryScore: categoryResult?.topScore || null,
      categoryCandidates: categoryResult?.candidates || [],
      heuristic: categoryResult?.heuristic || null,
      phrase: categoryResult?.phrase || {},
      semantic: categoryResult?.semantic || {},
      exclusion: categoryResult?.exclusion || {},
    },
    { upsert: true, new: true }
  );
  console.log("💾 Email saved:", emailDoc._id.toString());

  // 🔔 Emit SSE
  if (!existed) {
    inboxEvents.emit("inbox", {
      type: "NEW_EMAIL",
      userId: account.userId.toString(),
      data: {
        emailId: emailDoc._id,
        threadId: emailDoc.threadId,
        subject: emailDoc.subject,
        from: emailDoc.from,
        date: emailDoc.date,
        isRead: emailDoc.isRead,
      },
    });
  }

  // Update Thread Stats
  try {
    await updateThread(account, emailDoc);
  } catch (err) {
    console.error("❌ updateThread failed:", err.message);
  }

  // ----------------------------------------
  // ACTION INTELLIGENCE (AI) - FIXED
  // ----------------------------------------
  // Construct a cleaner object for the AI engine
  // 🔥 FIX 2: Ensure 'text' property exists (evaluators use 'text', DB uses 'textBody')
  const emailForEvaluator = {
    ...emailDoc.toObject(),
    text: emailDoc.textBody || emailDoc.snippet || "",
    subject: emailDoc.subject || ""
  };

  const threadMeta = {
    lastMessageFrom: emailDoc.isIncoming ? "other" : "me",
    lastMessageAt: emailDoc.date,
  };

  console.log("🧠 Evaluating actions for:", emailDoc._id.toString());
  const actionData = evaluateActions(emailForEvaluator, threadMeta);
  console.log("ACTION DATA:", actionData);

  // Update DB with results
  await Email.updateOne(
    { _id: emailDoc._id },
    { $set: actionData }
  );

  return emailDoc;
}

// Thread Helper
async function updateThread(account, emailDoc) {
  let thread = await Thread.findOne({
    threadId: emailDoc.threadId,
    accountId: account._id,
  });

  const isUnread = !emailDoc.isRead;

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
      unreadCount: isUnread ? 1 : 0,
      hasUnread: isUnread,
    });
    return;
  }

  if (!thread.messageIds.includes(emailDoc.messageId)) {
    thread.messageIds.push(emailDoc.messageId);
    if (isUnread) {
      thread.unreadCount = (thread.unreadCount || 0) + 1;
      thread.hasUnread = true;
    }
  }

  thread.lastMessageDate = emailDoc.date;
  thread.snippet = emailDoc.snippet;
  thread.participants = Array.from(
    new Set([...thread.participants, emailDoc.from, emailDoc.to])
  );

  await thread.save();
}

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
import {generateEmbedding} from '../utils/embedding.js';
import { classifyEmailFull } from "../classification/classificationEngine.js";
import cloudinary from '../config/cloudinary.js'; // <-- ADDED


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
    // console.log("this is list",list)
    const msgs = list.data.messages || [];
    // console.log("this is msgs",msgs)


    for (const m of msgs) {
      await syncSingleMessage(gmail, m.id, account);
    }
  } catch (err) {
    console.error('Sync error for account:', account.email, err);
  }
}

async function syncSingleMessage(gmail, messageId, account) {
  // Use upsert to avoid duplicates in race conditions
  const emailFilter = { messageId, accountId: account._id };

  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const payload = full.data.payload || {};
  const { htmlBody, textBody, inlineParts, attachmentParts } = parsePayloadDeep(payload);

  // Process HTML Inline Images (CID replacement)
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

  // Extract email headers
  const headers = payload.headers || [];
  const find = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
  const composedBody = finalHtml || (textBody ? `<pre>${textBody}</pre>` : "");

  // -------------------------------------------------------
  // CLOUDINARY ATTACHMENTS UPLOAD (FIXED)
  // -------------------------------------------------------
  const uploadedAttachments = [];

  for (const a of attachmentParts) {
    // Only upload image attachments — convert everything to JPG
    if (!a.mimeType || !a.mimeType.startsWith("image/")) {
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,
      });
      continue; // skip non-image attachments
    }

    // ----- PDF / DOC / DOCX SUPPORT -----
    if (a.mimeType?.includes("pdf") || 
        a.mimeType?.includes("msword") || 
        a.mimeType?.includes("officedocument")) {

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
        console.log("⬆️ Uploading PDF/DOC to Cloudinary...", a.filename);

        const uploadRes = await cloudinary.uploader.upload(dataUrl, {
          folder: "sigmamail/attachments",
          resource_type: "raw",
          filename_override: a.filename,
          format: undefined,
        });

        uploadedAttachments.push({
          filename: a.filename,
          mimeType: a.mimeType,
          size: uploadRes.bytes,
          storageUrl: uploadRes.secure_url,
        });

      } catch (err) {
        console.error("❌ Cloudinary RAW upload failed:", err.message);
        uploadedAttachments.push({
          filename: a.filename,
          mimeType: a.mimeType,
          size: 0,
          storageUrl: null,
        });
      }

      continue; // skip remaining image logic
    }

    // console.log("📎 Processing attachment:", {
    //   filename: a.filename,
    //   mimeType: a.mimeType,
    //   hasInlineData: !!a.data,
    //   hasAttachmentId: !!a.attachmentId,
    // });
    let base64 = null;

    // Gmail gives either base64 directly or via attachmentId → fetch raw
    if (a.data) {
      base64 = fixBase64(a.data);
    }

    if (!base64 && a.attachmentId) {
      base64 = await fetchAttachmentData(gmail, messageId, a.attachmentId);
    }

    // If NO BASE64, still store the attachment metadata so frontend can show filename + icon.
    if (!base64) {
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,   // no upload possible
      });
      // console.log("📦 Stored attachment metadata:", uploadedAttachments[uploadedAttachments.length - 1]);
      continue;
    }

    const dataUrl = `data:${a.mimeType};base64,${base64}`;

    try {
      console.log("⬆️ Uploading to Cloudinary...", {
        filename: a.filename,
        mimeType: a.mimeType,
      });
      const uploadRes = await cloudinary.uploader.upload(dataUrl, {
        folder: "sigmamail/attachments",
        filename_override: a.filename.replace(/\.[^.]+$/, "") + ".jpg",
        resource_type: "image",
        format: "jpg",
        transformation: [
          { quality: "90" }  // optional: good balance of size + clarity
        ],
      });
      // console.log("✅ Cloudinary upload success:", {
      //   public_id: uploadRes.public_id,
      //   url: uploadRes.secure_url,
      //   bytes: uploadRes.bytes,
      // });
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: uploadRes.bytes,
        storageUrl: uploadRes.secure_url,
      });
      // console.log("📦 Stored attachment metadata:", uploadedAttachments[uploadedAttachments.length - 1]);
    } catch (err) {
      // console.error("❌ Cloudinary upload FAILED:", {
      //   filename: a.filename,
      //   error: err.message,
      // });
      // Still store the attachment metadata
      uploadedAttachments.push({
        filename: a.filename,
        mimeType: a.mimeType,
        size: 0,
        storageUrl: null,
      });
      // console.log("📦 Stored attachment metadata:", uploadedAttachments[uploadedAttachments.length - 1]);
    }
  }

  // -------------------------------------------------------
  // DETECT EXTERNAL CLOUD ATTACHMENTS
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
        if (!name.includes(".")) return name + ".pdf"; // Common case: Drive PDFs drop extension
        return name;
      } catch {
        return "file.pdf";
      }
    };
    const seen = new Set();

    const collect = (url) => {
      if (seen.has(url)) return;
      seen.add(url);
      const provider = detectProvider(url);
      const filename = guessFilename(url);
      results.push({
        filename,
        mimeType: "application/octet-stream",
        size: 0,
        storageUrl: url,
        isExternal: true,
        provider,
      });
    };

    const anchorRegex = /<a[^>]+href=["'](https?:\/\/(?:drive\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|icloud\.com)[^"']*)["'][^>]*>/gi;
    let match;
    while ((match = anchorRegex.exec(html)) !== null) collect(match[1]);

    const bracketRegex = /<https?:\/\/(?:drive\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|icloud\.com)[^>\s]*>/gi;
    while ((match = bracketRegex.exec(text)) !== null) {
      const bracketUrl = match[0].slice(1, -1); // remove < >
      collect(bracketUrl);
    }

    const urlRegex = /(https?:\/\/(?:drive\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|icloud\.com)[^\s<>"']*)/gi;
    while ((match = urlRegex.exec(text)) !== null) collect(match[1]);

    return results;
  };

  const cloudLinks = extractExternalLinks(finalHtml || "", textBody || "");
  if (cloudLinks.length > 0) externalAttachments.push(...cloudLinks);
  uploadedAttachments.push(...externalAttachments);

  // 🔥 Remove duplicate attachments (same URL or same filename)
  const seenKeys = new Set();
  const deduped = [];

  for (const att of uploadedAttachments) {
    const key = att.storageUrl || att.filename;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(att);
  }

  uploadedAttachments.length = 0;
  uploadedAttachments.push(...deduped);

  // -------------------------------------------------------
  // STORE EMAIL IN MONGODB
  // -------------------------------------------------------
  // ---------------------
  // GENERATE EMBEDDING
  // ---------------------
  const cleanedText = [
    find("Subject"),
    textBody || finalHtml.replace(/<[^>]+>/g, "")
  ].join("\n").trim();

  let embeddingVector = null;
  try {
    embeddingVector = await generateEmbedding(cleanedText);
  } catch (err) {
    console.error("❌ Embedding generation failed for email:", err.message);
  }


    let categoryResult = null;

    try {
      categoryResult = await classifyEmailFull({
        subject: find("Subject"),
        from: find("From"),
        text: composedBody,
        plainText: textBody,
        embedding: embeddingVector
      });
    } catch (err) {
      console.error("❌ classifyEmailFull failed:", err);
    }

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
      date: new Date(find('Date')),

      textBody,
      htmlBodyRaw: htmlBody,
      htmlBodyProcessed: finalHtml,
      body: composedBody,

      inlineImages: inlineParts.map((i) => ({
        cid: i.cid,
        mimeType: i.mimeType,
      })),

      attachments: uploadedAttachments,
      hasAttachments: uploadedAttachments.length > 0,
      embedding: embeddingVector,

      labelIds: full.data.labelIds || [],
      snippet: full.data.snippet || '',
      hasInlineImages: inlineParts.length > 0,

      category: categoryResult?.top || null,
      categoryScore: categoryResult?.topScore || null,
      categoryCandidates: categoryResult?.candidates || [],
      heuristic: categoryResult?.heuristic || null,
    },
    { upsert: true, new: true }
  );

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

export function fixBase64(str) {
  if (!str) return "";
  // Normalize URL-safe base64, remove whitespace, and ensure padding in one step
  let s = String(str).replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const pad = s.length % 4;
  if (pad !== 0) s += "=".repeat(4 - pad);
  return s;
}

/**
 * parsePayloadDeep(payload)
 * - Iterative traversal (stack) to avoid recursion overhead
 * - Returns { htmlBody, textBody, inlineParts, attachmentParts }
 * - Keeps binary data as base64 strings (do not decode until needed)
 */
export function parsePayloadDeep(payload) {
  const inlineParts = [];
  const attachmentParts = [];
  let htmlBody = null;
  let textBody = null;

  if (!payload) return { htmlBody, textBody, inlineParts, attachmentParts };

  const stack = [payload];

  while (stack.length) {
    const part = stack.pop();
    if (!part) continue;

    const mime = part.mimeType || "";

    // HTML preferred. If no HTML, take text/plain as fallback.
    if (mime === "text/html" && part.body && part.body.data) {
      if (!htmlBody) {
        try {
          htmlBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
        } catch (e) {
          htmlBody = null;
        }
      }
    } else if (!htmlBody && mime === "text/plain" && part.body && part.body.data) {
      if (!textBody) {
        try {
          textBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
        } catch (e) {
          textBody = null;
        }
      }
    }

    // Images (inline via CID or attachments)
    if (mime.startsWith("image/")) {
      const cidHeader = (part.headers || []).find(h => String(h.name || "").toLowerCase() === "content-id");
      if (cidHeader && cidHeader.value) {
        inlineParts.push({
          cid: String(cidHeader.value).replace(/[<>]/g, ""),
          mimeType: mime,
          data: part.body ? part.body.data ?? null : null,
          attachmentId: part.body ? part.body.attachmentId ?? null : null,
          filename: part.filename ?? null
        });
      }

      if (part.body && part.body.attachmentId) {
        attachmentParts.push({
          attachmentId: part.body.attachmentId,
          mimeType: mime,
          filename: part.filename ?? null
        });
      }
    } else {
      // Non-image attachments with attachmentId (pdf/doc/raw)
      if (part.body && part.body.attachmentId) {
        attachmentParts.push({
          attachmentId: part.body.attachmentId,
          mimeType: mime,
          filename: part.filename ?? null
        });
      }
    }

    // Push subparts (preserve order by pushing reversed)
    if (Array.isArray(part.parts) && part.parts.length) {
      for (let i = part.parts.length - 1; i >= 0; i--) stack.push(part.parts[i]);
    }
  }

  return { htmlBody, textBody, inlineParts, attachmentParts };
}

/**
 * fetchAttachmentData(gmailClient, messageId, attachmentId)
 * - Safely fetches attachment and normalizes where the base64 data may be
 * - Returns normalized base64 string (unpadded converted), or null on error
 */
export async function fetchAttachmentData(gmailClient, messageId, attachmentId) {
  if (!gmailClient || !messageId || !attachmentId) return null;
  try {
    const att = await gmailClient.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId
    });

    // Gmail sometimes nests the base64 under different shapes
    const data = att && att.data ? (att.data.data ?? att.data.body?.data ?? null) : null;
    return data ? fixBase64(data) : null;
  } catch (err) {
    // Log server-side error for debugging but return null so caller can handle gracefully
    console.error("fetchAttachmentData error:", err && err.message ? err.message : err);
    return null;
  }
}
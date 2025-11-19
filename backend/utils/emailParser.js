export function fixBase64(str = "") {
  let fixed = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  while (fixed.length % 4 !== 0) fixed += "=";
  return fixed;
}

export function parsePayloadDeep(payload) {
  let htmlBody = "";
  let textBody = "";
  const inlineParts = [];
  const attachmentParts = [];

  function walk(part) {
    if (!part) return;

    if (part.mimeType === "text/html" && part.body?.data) {
      htmlBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
    }

    if (!htmlBody && part.mimeType === "text/plain" && part.body?.data) {
      textBody = Buffer.from(fixBase64(part.body.data), "base64").toString("utf8");
    }

    const cidHeader = part.headers?.find((h) => h.name === "Content-ID");
    if (cidHeader && part.mimeType?.startsWith("image/")) {
      inlineParts.push({
        cid: cidHeader.value.replace(/[<>]/g, ""),
        mimeType: part.mimeType,
        data: part.body?.data ?? null,
        attachmentId: part.body?.attachmentId ?? null,
        filename: part.filename || null,
      });
    }

    if (part.body?.attachmentId && part.mimeType?.startsWith("image/")) {
      attachmentParts.push({
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType,
        filename: part.filename || null,
      });
    }

    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }

  walk(payload);
  return { htmlBody, textBody, inlineParts, attachmentParts };
}

export async function fetchAttachmentData(gmail, messageId, attachmentId) {
  const att = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  return att.data?.data ? fixBase64(att.data.data) : null;
}
import fetch from "node-fetch";

function normalizeEmbeddingEndpoint(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Render `hostport` looks like `service-name:port`; add scheme in that case.
  const withScheme = raw.includes("://") ? raw : `http://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // If caller provided only host/base URL, default to the embedding endpoint.
  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/embed";
  }

  return url.toString();
}

const PREFERRED_EMBEDDING_URLS = [
  normalizeEmbeddingEndpoint(process.env.EMBEDDING_URL),
  normalizeEmbeddingEndpoint(process.env.CLASSIFIER_EMBED_URL),
].filter(Boolean);

export async function generateEmbedding(text) {
  for (const url of PREFERRED_EMBEDDING_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`Embedding failed: ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data.embedding)) return data.embedding;
    } catch (error) {
      console.error(`Embedding error via ${url}:`, error.message);
    }
  }
  console.error("Embedding error: no configured embedding endpoint responded.");
  return null;
}

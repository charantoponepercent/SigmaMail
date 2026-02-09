import fetch from "node-fetch";

const PREFERRED_EMBEDDING_URLS = [
  process.env.EMBEDDING_URL,
  process.env.CLASSIFIER_EMBED_URL,
  "http://localhost:8000/embed",
  "http://127.0.0.1:8000/embed",
  "http://embedding-service:8000/embed",
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

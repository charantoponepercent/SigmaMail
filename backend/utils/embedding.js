import fetch from "node-fetch";

const EMBEDDING_URL =
  process.env.EMBEDDING_URL || "http://embedding-service:8000/embed";

export async function generateEmbedding(text) {
  try {
    const res = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Embedding failed: ${res.status}`);
    }

    const data = await res.json();
    return data.embedding;
  } catch (error) {
    console.error("Embedding error:", error.message);
    return null;
  }
}
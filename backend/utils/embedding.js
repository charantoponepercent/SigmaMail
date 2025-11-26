import fetch from "node-fetch";

export async function generateEmbedding(text) {
  try {
    const res = await fetch("http://127.0.0.1:8000/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!res.ok) throw new Error("Embedding request failed");

    const data = await res.json();
    return data.embedding; // array of 768 floats
  } catch (error) {
    console.error("Embedding error:", error);
    return null;
  }
}
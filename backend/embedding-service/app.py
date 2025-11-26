# embedding-service/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
from sentence_transformers import SentenceTransformer
import numpy as np
import uvicorn
import os

# Use model name you prefer
MODEL_NAME = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

app = FastAPI(title="SigmaMail Embedding Service")

class SingleRequest(BaseModel):
    text: str
    normalize: Optional[bool] = True

class BatchRequest(BaseModel):
    texts: List[str]
    normalize: Optional[bool] = True

# Load model once at startup
print("Loading embedding model:", MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)
print("Model loaded.")

def to_list(vec: np.ndarray) -> List[float]:
    return vec.astype(float).tolist()

@app.post("/embed", summary="Return embedding for a single text")
async def embed_single(req: SingleRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    emb = model.encode(req.text, convert_to_numpy=True, show_progress_bar=False)
    if req.normalize:
        # L2 normalize
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
    return {"embedding": to_list(emb)}

@app.post("/embed/batch", summary="Return embeddings for multiple texts")
async def embed_batch(req: BatchRequest):
    if not req.texts or len(req.texts) == 0:
        raise HTTPException(status_code=400, detail="texts list required")
    emb = model.encode(req.texts, convert_to_numpy=True, show_progress_bar=False)
    if req.normalize:
        # Normalize each vector row-wise
        norms = np.linalg.norm(emb, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        emb = emb / norms
    # convert to python lists
    results = [to_list(row) for row in emb]
    return {"embeddings": results}

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, workers=1)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Copy requirements
COPY requirements.txt .

# Install CPU-only torch first to avoid pulling large CUDA wheels,
# then install the remaining Python dependencies.
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.2.2 \
    && pip install -r requirements.txt

# Copy app
COPY app.py .

# Expose port inside docker network
EXPOSE 8000

# Start embedding server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

FROM python:3.10-slim

WORKDIR /app

# Install system deps (minimal)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install python deps
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Expose port inside docker network
EXPOSE 8000

# Start embedding server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
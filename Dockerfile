# ===================================================
# Stage 1: Build the React Frontend with Vite
# ===================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline || npm install
COPY . .
RUN npm run build

# ===================================================
# Stage 2: Unified Production Python Engine (FastAPI)
# ===================================================
FROM python:3.10-slim
WORKDIR /app

# Install lightweight dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend files and pre-built frontend dist
COPY . .
COPY --from=frontend-builder /app/dist /app/dist

ENV PORT=8000
EXPOSE 8000

# Start Uvicorn bound to dynamic cloud PORT (defaults to 8000)
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

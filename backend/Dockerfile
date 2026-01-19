# ---------- Base ----------
    FROM node:20-alpine

    # ---------- System deps ----------
    RUN apk add --no-cache \
      python3 \
      make \
      g++ \
      libc6-compat
    
    # ---------- App directory ----------
    WORKDIR /app
    
    # ---------- Install deps ----------
    COPY package*.json ./
    RUN npm install --production
    
    # ---------- Copy source ----------
    COPY . .
    
    # ---------- Environment ----------
    ENV NODE_ENV=production
    ENV PORT=4000
    
    # ---------- Expose API port ----------
    EXPOSE 4000
    
    # ---------- Default command (API) ----------
    CMD ["node", "index.js"]
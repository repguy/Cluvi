# BotBuilder — VPS Deployment Guide

This guide covers deploying BotBuilder on a Linux VPS (Ubuntu 22.04 recommended) with Nginx, SSL, and PM2.

---

## Prerequisites

- A VPS with at least 1 GB RAM (2 GB recommended)
- Ubuntu 22.04 LTS
- A domain name pointed to your VPS IP (`A` record → your server IP)
- SSH access as root or a sudo user

---

## 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should be v20.x
npm -v

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

---

## 2. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER botbuilder WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE botbuilder OWNER botbuilder;
GRANT ALL PRIVILEGES ON DATABASE botbuilder TO botbuilder;
EOF
```

---

## 3. Clone the Repository

```bash
# Create app directory
mkdir -p /var/www/botbuilder
cd /var/www/botbuilder

# Clone your repo (use your actual repo URL)
git clone https://github.com/yourusername/botbuilder.git .

# Install dependencies
pnpm install
```

---

## 4. Set Environment Variables

Create a `.env` file in the project root:

```bash
nano /var/www/botbuilder/.env
```

Add the following (replace all values):

```env
# Database
DATABASE_URL=postgresql://botbuilder:your_strong_password_here@localhost:5432/botbuilder

# Session secret — generate with: openssl rand -hex 32
SESSION_SECRET=your_super_secret_session_key_here

# Node environment
NODE_ENV=production
```

---

## 5. Run Database Migrations

The app automatically runs startup migrations when it starts. You only need to create the initial tables manually once:

```bash
cd /var/www/botbuilder

# Push the schema to your database using drizzle-kit
cd lib/db
DATABASE_URL="postgresql://botbuilder:your_password@localhost:5432/botbuilder" npx drizzle-kit push
cd ../..

# Create the session table (required by connect-pg-simple)
sudo -u postgres psql -d botbuilder -c "
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE \"default\",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
"
```

---

## 6. Build the Applications

```bash
cd /var/www/botbuilder

# Build the API server
pnpm --filter @workspace/api-server run build

# Build the frontend
pnpm --filter @workspace/chatbot-saas run build
```

---

## 7. Configure PM2

Create a PM2 ecosystem file:

```bash
nano /var/www/botbuilder/ecosystem.config.cjs
```

```js
module.exports = {
  apps: [
    {
      name: "botbuilder-api",
      script: "/var/www/botbuilder/artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/botbuilder/artifacts/api-server",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        DATABASE_URL: "postgresql://botbuilder:your_password@localhost:5432/botbuilder",
        SESSION_SECRET: "your_session_secret_here",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
```

Start with PM2:

```bash
cd /var/www/botbuilder
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # follow the printed command to run PM2 on boot
```

---

## 8. Serve the Frontend

The React frontend builds to a static folder. Nginx will serve it directly.

```bash
ls /var/www/botbuilder/artifacts/chatbot-saas/dist
# You should see index.html and assets/
```

---

## 9. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/botbuilder
```

Paste this config (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Serve the React SPA
    root /var/www/botbuilder/artifacts/chatbot-saas/dist;
    index index.html;

    # API proxy — forward /api/* to the Express server
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/botbuilder /etc/nginx/sites-enabled/
sudo nginx -t          # test config
sudo systemctl reload nginx
```

---

## 10. Enable HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot will auto-modify your nginx config and set up renewal
# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## 11. Firewall Setup

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 12. Updating the App

When you push new code:

```bash
cd /var/www/botbuilder

# Pull latest code
git pull origin main

# Install any new dependencies
pnpm install

# Rebuild API
pnpm --filter @workspace/api-server run build

# Rebuild frontend
pnpm --filter @workspace/chatbot-saas run build

# Restart the API server
pm2 restart botbuilder-api

# Nginx auto-serves new frontend build — no restart needed
```

---

## 13. Monitoring & Logs

```bash
# View live logs
pm2 logs botbuilder-api

# View last 100 lines
pm2 logs botbuilder-api --lines 100

# Monitor CPU/memory
pm2 monit

# Check status
pm2 status
```

---

## 14. Quick Reference

| What | Value |
|------|-------|
| App root | `/var/www/botbuilder` |
| Frontend build | `/var/www/botbuilder/artifacts/chatbot-saas/dist` |
| API port | `3001` (internal, proxied by Nginx) |
| Nginx config | `/etc/nginx/sites-available/botbuilder` |
| PM2 config | `/var/www/botbuilder/ecosystem.config.cjs` |
| Logs | `pm2 logs botbuilder-api` |
| DB | `postgresql://botbuilder:***@localhost:5432/botbuilder` |

---

## 15. Optional: Docker Compose Alternative

If you prefer Docker, create `docker-compose.yml` in the project root:

```yaml
version: "3.9"
services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: botbuilder
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: botbuilder
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: artifacts/api-server/Dockerfile
    restart: always
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://botbuilder:your_password@db:5432/botbuilder
      SESSION_SECRET: your_session_secret
      NODE_ENV: production
      PORT: 3001
    depends_on:
      - db

volumes:
  pgdata:
```

Then run:
```bash
docker compose up -d
```

And point Nginx at `localhost:3001` as above.

---

## Troubleshooting

**502 Bad Gateway** — API server not running. Check `pm2 status` and `pm2 logs botbuilder-api`.

**Database connection error** — Verify `DATABASE_URL` in your env. Check `sudo systemctl status postgresql`.

**Widget not loading on client site** — Ensure your domain's DNS points to the VPS. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`.

**Session not persisting** — Make sure the `session` table exists in PostgreSQL (step 5).

**Changes not showing** — Rebuild frontend (`pnpm --filter @workspace/chatbot-saas run build`) and hard refresh the browser.

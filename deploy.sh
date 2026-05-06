#!/usr/bin/env bash
# =============================================================================
#  BotBuilder — Ubuntu 22.04 VPS Deployment Script
# =============================================================================
set -euo pipefail

# ─── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# =============================================================================
#  CONFIG — edit these before running
# =============================================================================
APP_DIR="/opt/botbuilder"          # where the app lives on the server
APP_USER="botbuilder"              # linux user that runs the app (created if missing)
DOMAIN=""                          # your domain, e.g. chat.example.com (leave blank to skip SSL)
DB_NAME="botbuilder"
DB_USER="botbuilder"
DB_PASS=""                         # leave blank → script auto-generates a strong password
SESSION_SECRET=""                  # leave blank → script auto-generates one
NODE_VERSION="22"                  # Node.js major version (22 LTS recommended)

# ─── Auto-generate secrets if not set ────────────────────────────────────────
[[ -z "$DB_PASS" ]]        && DB_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
[[ -z "$SESSION_SECRET" ]] && SESSION_SECRET=$(openssl rand -base64 48)

# =============================================================================
#  PRE-FLIGHT
# =============================================================================
[[ "$EUID" -ne 0 ]] && die "Run this script as root (or with sudo)."
[[ ! -f "$(pwd)/package.json" ]] && die "Run this script from the project root (where package.json lives)."
SOURCE_DIR="$(pwd)"

info "BotBuilder VPS deploy — source: $SOURCE_DIR → dest: $APP_DIR"

# =============================================================================
#  1. SYSTEM PACKAGES
# =============================================================================
info "Updating apt and installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -yq \
  curl wget gnupg ca-certificates \
  nginx \
  postgresql postgresql-contrib \
  certbot python3-certbot-nginx \
  git build-essential \
  openssl ufw

ok "System packages installed."

# =============================================================================
#  2. NODE.JS (via NodeSource)
# =============================================================================
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].slice(1))')" -lt "$NODE_VERSION" ]]; then
  info "Installing Node.js $NODE_VERSION LTS..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -yq nodejs
fi
ok "Node.js $(node -v) ready."

# =============================================================================
#  3. PNPM
# =============================================================================
if ! command -v pnpm &>/dev/null; then
  info "Installing pnpm..."
  npm install -g pnpm
fi
ok "pnpm $(pnpm -v) ready."

# =============================================================================
#  4. PM2 (process manager)
# =============================================================================
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  npm install -g pm2
fi
ok "PM2 $(pm2 -v) ready."

# =============================================================================
#  5. APP USER
# =============================================================================
if ! id "$APP_USER" &>/dev/null; then
  info "Creating system user '$APP_USER'..."
  useradd --system --shell /bin/bash --create-home "$APP_USER"
fi
ok "User '$APP_USER' ready."

# =============================================================================
#  6. POSTGRESQL
# =============================================================================
info "Configuring PostgreSQL..."
systemctl enable postgresql --now

# Create role and database (idempotent)
sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;"

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" \
  | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
ok "PostgreSQL ready — database '$DB_NAME'."

# =============================================================================
#  7. COPY / SYNC APP FILES
# =============================================================================
info "Syncing application files to $APP_DIR..."
mkdir -p "$APP_DIR"

rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='*/dist' \
  --exclude='.local' \
  --exclude='attached_assets' \
  "$SOURCE_DIR/" "$APP_DIR/"

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "Files synced."

# =============================================================================
#  8. WRITE .ENV FILE
# =============================================================================
info "Writing /etc/botbuilder.env ..."
cat > /etc/botbuilder.env <<EOF
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=8080
EOF
chmod 600 /etc/botbuilder.env
ok ".env written."

# =============================================================================
#  9. INSTALL DEPENDENCIES & BUILD
# =============================================================================
info "Installing npm dependencies (pnpm install)..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --frozen-lockfile"

info "Building API server..."
sudo -u "$APP_USER" bash -c "
  cd $APP_DIR
  set -a; source /etc/botbuilder.env; set +a
  pnpm --filter @workspace/api-server run build
"

info "Building frontend (Vite static)..."
sudo -u "$APP_USER" bash -c "
  cd $APP_DIR
  PORT=3000 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/chatbot-saas run build
"

ok "Build complete."

# =============================================================================
#  10. PM2 ECOSYSTEM FILE
# =============================================================================
info "Writing PM2 ecosystem config..."
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: 'botbuilder-api',
      script: 'dist/index.mjs',
      cwd: '${APP_DIR}/artifacts/api-server',
      interpreter: 'none',
      node_args: '--enable-source-maps',
      env_file: '/etc/botbuilder.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/botbuilder/api-error.log',
      out_file: '/var/log/botbuilder/api-out.log',
    },
  ],
};
EOF

mkdir -p /var/log/botbuilder
chown -R "$APP_USER:$APP_USER" /var/log/botbuilder
ok "PM2 config written."

# =============================================================================
#  11. START / RELOAD API WITH PM2
# =============================================================================
info "Starting API server with PM2..."
sudo -u "$APP_USER" bash -c "
  set -a; source /etc/botbuilder.env; set +a
  pm2 delete botbuilder-api 2>/dev/null || true
  pm2 start ${APP_DIR}/ecosystem.config.cjs
  pm2 save
"

# Make PM2 survive reboots
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true
ok "API server running via PM2."

# =============================================================================
#  12. NGINX
# =============================================================================
info "Configuring Nginx..."

NGINX_SERVER_NAME="${DOMAIN:-_}"
STATIC_ROOT="$APP_DIR/artifacts/chatbot-saas/dist/public"

cat > /etc/nginx/sites-available/botbuilder <<NGINX
server {
    listen 80;
    server_name ${NGINX_SERVER_NAME};

    # ── API proxy ──────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_read_timeout 120s;
        client_max_body_size 5m;
    }

    # ── Widget script (served by API, no caching) ──────────────────
    location /widget/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # ── Static frontend ────────────────────────────────────────────
    location / {
        root  ${STATIC_ROOT};
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # Long-cache assets (hashed filenames)
        location ~* \.(js|css|woff2?|ttf|svg|png|jpg|ico|webp)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/javascript;
    gzip_min_length 1024;
}
NGINX

ln -sf /etc/nginx/sites-available/botbuilder /etc/nginx/sites-enabled/botbuilder
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx --now
systemctl reload nginx
ok "Nginx configured."

# =============================================================================
#  13. FIREWALL (UFW)
# =============================================================================
info "Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ok "Firewall active (SSH + HTTP/HTTPS open)."

# =============================================================================
#  14. SSL WITH CERTBOT (optional, only if DOMAIN is set)
# =============================================================================
if [[ -n "$DOMAIN" ]]; then
  info "Requesting Let's Encrypt SSL certificate for $DOMAIN..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect || warn "Certbot failed — check DNS and try manually: certbot --nginx -d $DOMAIN"
  ok "SSL certificate installed."
else
  warn "DOMAIN not set — skipping SSL. Set DOMAIN at the top of this script and re-run, or run: certbot --nginx -d yourdomain.com"
fi

# =============================================================================
#  DONE
# =============================================================================
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  BotBuilder deployed successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard:   http://${DOMAIN:-<your-server-ip>}/"
echo -e "  API base:    http://${DOMAIN:-<your-server-ip>}/api/"
echo -e "  API logs:    pm2 logs botbuilder-api"
echo -e "  API status:  pm2 status"
echo -e "  Nginx logs:  journalctl -u nginx -f"
echo ""
echo -e "  DB URL:      ${DATABASE_URL}"
echo -e "  Secrets are saved in: /etc/botbuilder.env (chmod 600)"
echo ""
echo -e "  To redeploy after code changes, run:  sudo bash ${SOURCE_DIR}/deploy.sh"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"

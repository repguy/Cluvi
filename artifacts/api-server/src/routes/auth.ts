import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── In-memory auth rate limiter: 10 attempts per 15min per IP ─────────────
interface REntry { count: number; resetAt: number }
const authLimiter = new Map<string, REntry>();

function checkAuthLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    authLimiter.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authLimiter.entries()) if (now > v.resetAt) authLimiter.delete(k);
}, 5 * 60_000);

function getIp(req: import("express").Request) {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

// ── Register ───────────────────────────────────────────────────────────────
router.post("/auth/register", async (req, res) => {
  if (!checkAuthLimit(getIp(req))) {
    res.status(429).json({ message: "Too many attempts. Please wait 15 minutes." });
    return;
  }

  try {
    const { username, email, password } = req.body as { username: string; email: string; password: string };

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      res.status(400).json({ message: "Username, email, and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: "Please enter a valid email address" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "An account with that email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ username: username.trim().slice(0, 50), email: email.toLowerCase().trim(), passwordHash })
      .returning();

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) { req.log.error({ err }, "session save error after register"); }
    });
    res.status(201).json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// ── Login ──────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  if (!checkAuthLimit(getIp(req))) {
    res.status(429).json({ message: "Too many login attempts. Please wait 15 minutes." });
    return;
  }

  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email?.trim() || !password?.trim()) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

    // Constant-time comparison even if user not found (prevents timing attacks)
    const hash = user?.passwordHash ?? "$2a$12$invalidsaltinvalidsaltinvalids.invalidhashstring123456";
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) { req.log.error({ err }, "session save error after login"); }
    });
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

// ── Logout ─────────────────────────────────────────────────────────────────
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ── Me ─────────────────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db
      .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);

    if (!user) { res.status(401).json({ message: "Unauthorized" }); return; }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

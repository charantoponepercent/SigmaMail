// backend/routes/authRoutes.js
import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";

dotenv.config();
const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly"
];

// Start OAuth flow. Accepts ?userEmail=<app user email> for dev.
router.get("/google", (req, res) => {
  const userEmail = req.query.userEmail || ""; // in prod pass user id in state instead
  const state = JSON.stringify({ userEmail, ts: Date.now() });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token
    scope: SCOPES,
    state,
  });

  res.redirect(url);
});

// Callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");

    // exchange
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // get profile (email)
    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const profileResp = await oauth2.userinfo.get();
    const profile = profileResp.data;
    const gEmail = profile.email;
    const gId = profile.id;

    // figure out which app user to attach to
    let userEmailFromState = null;
    try { userEmailFromState = state ? JSON.parse(state).userEmail : null; } catch(e){}

    // find or create app user; prefer state-provided email, else use Gmail profile email
    const appUserEmail = userEmailFromState || gEmail;
    let user = await User.findOne({ email: appUserEmail });
    if (!user) user = await User.create({ email: appUserEmail, name: profile.name || appUserEmail.split("@")[0] });

    // store account record (upsert)
    const upsert = {
      userId: user._id,
      provider: "gmail",
      email: gEmail,
      googleId: gId,
      accessToken: tokens.access_token,
      // WARNING: store encrypted in prod!
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scopes: tokens.scope ? tokens.scope.split(" ") : SCOPES,
    };

    // If refreshToken is missing (Google sometimes doesn't return), keep existing refreshToken if present
    const existing = await EmailAccount.findOne({ userId: user._id, email: gEmail });
    if (existing && !upsert.refreshToken) upsert.refreshToken = existing.refreshToken;

    await EmailAccount.findOneAndUpdate({ userId: user._id, email: gEmail }, upsert, { upsert: true, new: true });

    console.log("Gmail account connected:", gEmail, "for app user:", user.email);
    // For now show a friendly page
    res.send(`<h3>Connected ${gEmail} for ${user.email} ✅</h3><p>You can close this window.</p>`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;

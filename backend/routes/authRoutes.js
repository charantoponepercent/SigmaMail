// backend/routes/authRoutes.js
import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";

dotenv.config();
const router = express.Router();

// 🔹 Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 🔹 Define Gmail Scopes
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// ------------------------------
// 1️⃣ STEP 1: START GOOGLE OAUTH
// ------------------------------
router.get("/google", async (req, res) => {
  try {
    // The app user’s ID or email is sent as query param
    const { userId, userEmail } = req.query;

    if (!userId && !userEmail) {
      return res.status(400).send("Missing user identifier (userId or userEmail)");
    }

    // Pack it safely in state for callback
    const state = JSON.stringify({ userId, userEmail, timestamp: Date.now() });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });

    res.redirect(authUrl);
  } catch (err) {
    console.error("❌ Error starting OAuth:", err);
    res.status(500).send("Failed to start OAuth");
  }
});

// ---------------------------------
// 2️⃣ STEP 2: HANDLE OAUTH CALLBACK
// ---------------------------------
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing OAuth code");

    // Parse user info from state
    let stateData = {};
    try {
      stateData = JSON.parse(state);
    } catch {
      console.warn("⚠️ Invalid state data");
    }

    const userIdFromState = stateData.userId || null;
    const userEmailFromState = stateData.userEmail || null;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get Gmail user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    const gmailAddress = profile.data.email;

    // ✅ Find or create app-level user
    let appUser;
    if (userIdFromState) {
      appUser = await User.findById(userIdFromState);
    } else if (userEmailFromState) {
      appUser = await User.findOne({ email: userEmailFromState });
    }

    if (!appUser) {
      appUser = await User.create({
        email: userEmailFromState || gmailAddress,
        name: gmailAddress.split("@")[0],
      });
    }

    // ✅ Save this Gmail account under that user
    const accountData = {
      userId: appUser._id,
      provider: "gmail",
      email: gmailAddress,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scopes: SCOPES,
    };

    // If already connected, update; else insert
    const existing = await EmailAccount.findOne({
      userId: appUser._id,
      email: gmailAddress,
    });

    if (existing) {
      await EmailAccount.updateOne({ _id: existing._id }, accountData);
    } else {
      await EmailAccount.create(accountData);
    }

    console.log(`✅ Gmail connected: ${gmailAddress} → User: ${appUser.email}`);

    res.send(`
      <h2>✅ Gmail connected successfully</h2>
      <p>Account: ${gmailAddress}</p>
      <p>Linked to: ${appUser.email}</p>
      <p>You can close this window and return to the app.</p>
    `);
  } catch (err) {
    console.error("❌ Error in OAuth callback:", err);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;

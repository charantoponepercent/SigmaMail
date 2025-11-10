import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes define what access your app will have
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
];

// 1️⃣ Route: Start Google OAuth flow
router.get("/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures refresh_token is returned
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// 2️⃣ Route: Handle Google redirect (callback)
router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing authorization code");

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Extract tokens (we'll store refresh_token later)
    console.log("✅ Tokens received:", tokens);

    // Show success message temporarily
    res.send(
      "<h2>Gmail account connected successfully ✅</h2><p>You can close this tab now.</p>"
    );
  } catch (err) {
    console.error("Error during OAuth callback:", err);
    res.status(500).send("OAuth failed. Check backend logs.");
  }
});

export default router;

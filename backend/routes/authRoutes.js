import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import mongoose from "mongoose";
import EmailAccount from "../models/EmailAccount.js";
import User from "../models/User.js";

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
  "https://www.googleapis.com/auth/gmail.readonly",
  // "https://www.googleapis.com/auth/gmail.metadata"
];


// Step 1: Start Google OAuth
router.get("/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// Step 2: Handle callback
router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get Gmail profile info
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    const emailAddress = profile.data.emailAddress;

    // Check if user exists or create new
    let user = await User.findOne({ email: emailAddress });
    if (!user) {
      user = await User.create({ email: emailAddress, name: emailAddress.split("@")[0] });
    }

    // Save account info (multi-account ready)
    await EmailAccount.findOneAndUpdate(
      { userId: user._id, email: emailAddress },
      {
        provider: "gmail",
        email: emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expiry_date),
        scopes: tokens.scope?.split(" ") || [],
      },
      { upsert: true, new: true }
    );

    console.log("✅ Gmail account connected:", emailAddress);
    res.send("<h2>Gmail account connected successfully ✅</h2>");
  } catch (err) {
    console.error("❌ Error in OAuth callback:", err);
    res.status(500).send("OAuth failed. Check logs.");
  }
});

export default router;

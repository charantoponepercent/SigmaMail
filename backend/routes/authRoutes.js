// backend/routes/authRoutes.js
import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import User from "../models/User.js";
import EmailAccount from "../models/EmailAccount.js";
import { enqueueInitialSync } from "../queues/gmailInitialSync.queue.js";

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

    //  Get Gmail user info
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

    // 🔎 Check if this Gmail account already exists for the user
    const existing = await EmailAccount.findOne({
      userId: appUser._id,
      email: gmailAddress,
    });

    let account;

    if (existing) {
      account = await EmailAccount.findOneAndUpdate(
        { _id: existing._id },
        accountData,
        { new: true }
      );
    } else {
      account = await EmailAccount.create(accountData);
    }

    // 🔥 Trigger initial Gmail sync in background (BullMQ)
    if (!account.initialSyncDone) {
      await enqueueInitialSync(account._id);
    }

    console.log(`✅ Gmail connected: ${gmailAddress} → User: ${appUser.email}`);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              max-width: 500px;
              width: 100%;
              padding: 48px 40px;
              text-align: center;
            }
            .icon {
              width: 64px;
              height: 64px;
              background:rgb(71, 200, 36);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              animation: scaleIn 0.5s ease-out;
            }
            .checkmark {
              color: white;
              font-size: 32px;
              font-weight: bold;
            }
            h2 {
              color: #000000;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 16px;
              letter-spacing: -0.5px;
            }
            .info-card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
              text-align: left;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              color: #6b7280;
              font-size: 14px;
              font-weight: 500;
            }
            .value {
              color: #000000;
              font-size: 14px;
              font-weight: 600;
              max-width: 60%;
              text-align: right;
              word-break: break-all;
            }
            .gmail {
              color: #2563eb;
            }
            .footer {
              color: #6b7280;
              font-size: 14px;
              margin-top: 24px;
              line-height: 1.6;
            }
            @keyframes scaleIn {
              from {
                transform: scale(0);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">
              <span class="checkmark">✓</span>
            </div>
            <h2>Gmail Connected Successfully</h2>
            <div class="info-card">
              <div class="info-row">
                <span class="label">Gmail Account</span>
                <span class="value gmail">${gmailAddress}</span>
              </div>
              <div class="info-row">
                <span class="label">Linked to</span>
                <span class="value">${appUser.email}</span>
              </div>
            </div>
            <p class="footer">
              Your Gmail account has been securely linked.<br>
              You can now close this window and return to the app.
            </p>
          </div>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error("❌ Error in OAuth callback:", err);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;

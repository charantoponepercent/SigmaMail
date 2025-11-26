// scripts/seedCategories.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load ../.env (one folder above)
dotenv.config({ path: join(__dirname, "../.env") });

import mongoose from "mongoose";
import Category from "../models/Category.js";
import { generateEmbedding } from "../utils/embedding.js"; // your existing util


const MONGO = process.env.MONGO_URI;

const CATEGORIES = [
    {
      name: "Work",
      description:
        "Professional correspondence involving internal team operations, external client management, or project execution. Includes scheduling (calendar invites, zoom links, agendas), deliverables (reports, slide decks, feedback), administrative tasks (HR updates, payroll, OOO replies), and corporate platform notifications (Slack, Jira, Asana). Tone is generally formal or semi-formal.",
    },
    {
      name: "Personal",
      description:
        "Direct, human-to-human communication with friends, family, or acquaintances. Includes casual conversation, life updates, event planning (weddings, parties), shared photos, and non-commercial discussions. Characterized by informal language, slang, emotional context, and lack of commercial headers or footers.",
    },
    {
      name: "Finance",
      description:
        "Official financial documentation and banking alerts. Includes bank statements, credit card transaction alerts, tax documents (1099, W2), investment portfolio updates, insurance policies, loan status, salary slips, and utility bills. distinct from 'Shopping' as it focuses on money management, assets, and liabilities rather than consumer goods.",
    },
    {
      name: "Shopping",
      description:
        "Transactional emails regarding the purchase of physical or digital goods. Includes order confirmations, shipping tracking numbers, delivery status (out for delivery, delivered), electronic receipts, return labels, and refund notifications. Focuses on the lifecycle of a specific order from e-commerce platforms (Amazon, Shopify, retail brands).",
    },
    {
      name: "Travel",
      description:
        "Logistics and itineraries for transportation and accommodation. Includes flight booking confirmations (PNR codes, boarding passes), hotel or Airbnb reservations, car rental receipts, ride-share summaries (Uber/Lyft), train tickets, visa applications, and frequent flyer status updates.",
    },
    {
      name: "Education",
      description:
        "Academic and learning-related communications. Includes university announcements, assignment deadlines, grade releases, enrollment verifications, Learning Management System (LMS) notifications (Canvas, Blackboard), online course certificates (Coursera, Udemy), and webinar registrations.",
    },
    {
      name: "Promotions",
      description:
        "Unsolicited or opt-in marketing material aiming to generate sales or engagement. Includes newsletters, discount codes, flash sales, 'you might also like' recommendations, product launches, seasonal offers, and brand storytelling. Characterized by persuasive copywriting and heavy use of graphics.",
    },
    {
      name: "Subscriptions",
      description:
        "Notifications regarding recurring services and memberships. Includes SaaS billing receipts, streaming service renewals (Netflix, Spotify), newsletter subscription confirmations, free trial expiration warnings, auto-pay notifications, and membership tier changes.",
    },
    {
      name: "Social",
      description:
        "Automated notifications from social networking platforms and forums. Includes 'new follower' alerts, mentions, tagged photos, comment notifications, connection requests (LinkedIn), digest emails summarizing network activity, and direct messages sent via platform gateways.",
    },
    {
      name: "Priority",
      description:
        "High-urgency security and authentication alerts requiring immediate attention. Includes Two-Factor Authentication (2FA) codes, One-Time Passwords (OTP), password reset links, 'new login from unrecognized device' warnings, legal notices, and fraud detection alerts.",
    },
  ];

async function main() {
  await mongoose.connect(MONGO, {});

  console.log("Connected to Mongo:", MONGO);

  for (const cat of CATEGORIES) {
    try {
      console.log("Generating embedding for:", cat.name);
      const emb = await generateEmbedding(`${cat.name}. ${cat.description}`);
      if (!emb) {
        console.warn("No embedding returned for", cat.name);
        continue;
      }

      // Upsert category
      const existing = await Category.findOne({ name: cat.name });
      if (existing) {
        existing.description = cat.description;
        existing.embedding = emb;
        existing.updatedAt = new Date();
        await existing.save();
        console.log(`Updated category: ${cat.name}`);
      } else {
        await Category.create({
          name: cat.name,
          description: cat.description,
          embedding: emb,
        });
        console.log(`Created category: ${cat.name}`);
      }
    } catch (err) {
      console.error("Seed error for", cat.name, err);
    }
  }

  console.log("Done seeding categories.");
  await mongoose.disconnect();
  process.exit(0);
}

main();
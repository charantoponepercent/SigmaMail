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
    seedText: "Professional communication about projects, tasks, meetings, and corporate work coordination."
  },
  {
    name: "Personal",
    seedText: "Casual messages between friends or family sharing personal updates or informal conversations."
  },
  {
    name: "Finance",
    seedText: "Banking or financial updates including statements, transactions, balances, and investment notices."
  },
  {
    name: "Bills",
    seedText: "Payment reminders or invoices indicating due amounts and billing deadlines for services."
  },
  {
    name: "Shopping",
    seedText: "Order confirmations, shipping updates, tracking details, and delivery information for purchases."
  },
  {
    name: "Travel",
    seedText: "Flight or hotel bookings, itineraries, reservation confirmations, and trip schedule information."
  },
  {
    name: "Promotions",
    seedText: "Marketing emails containing sales, discounts, special offers, or promotional announcements."
  },
  {
    name: "Subscriptions",
    seedText: "Service or membership renewal notices, plan updates, and recurring subscription notifications."
  },
  {
    name: "Social",
    seedText: "Notifications about followers, comments, tags, mentions, or other social media activity."
  },
  {
    name: "Priority",
    seedText: "Security alerts requiring urgent action such as OTP codes, login warnings, or verification prompts."
  },
  {
    name: "Spam",
    seedText: "Unsolicited or deceptive emails offering unrealistic rewards, promotions, or phishing content."
  },
  {
    name: "General",
    seedText: "Neutral informational emails or automated confirmations without a specific category context."
  }
];

async function main() {
  await mongoose.connect(MONGO, {});

  console.log("Connected to Mongo:", MONGO);

  for (const cat of CATEGORIES) {
    try {
      console.log("Generating embedding for:", cat.name);
      const emb = await generateEmbedding(`${cat.name}. ${cat.seedText}`);
      if (!emb) {
        console.warn("No embedding returned for", cat.name);
        continue;
      }

      // Upsert category
      const existing = await Category.findOne({ name: cat.name });
      if (existing) {
        existing.description = cat.seedText;
        existing.embedding = emb;
        existing.updatedAt = new Date();
        await existing.save();
        console.log(`Updated category: ${cat.name}`);
      } else {
        await Category.create({
          name: cat.name,
          description: cat.seedText,
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
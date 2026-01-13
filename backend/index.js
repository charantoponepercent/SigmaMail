import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import userAuthRoutes from './routes/userAuthRoutes.js';
import testEmbedding from "./routes/testEmbedding.js";
import searchRoutes from "./routes/search.js";
import "./config/db.js";
import gmailWebhook from "./routes/gmailWebhook.js";



dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors());


// Test route
app.get('/', (req, res) => {
  res.send('Backend API is working ✅');
});

app.use("/authe", userAuthRoutes);
app.use("/auth", authRoutes); // ✅
app.use("/api", apiRoutes);
app.use("/test", testEmbedding);
app.use("/search_api", searchRoutes);
app.use("/api/webhooks", gmailWebhook);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

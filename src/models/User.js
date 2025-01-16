const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  instagramCredentials: {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, unique: true },
  },
  niches: { type: [String], default: [] },
  videos: { type: [Object], default: [] },
  accountType: { type: String, enum: ["free", "basic", "pro"], default: "free" },
  isBilled: { type: Boolean, default: false },
  dailyLimit: { type: Number, default: 1 }, // Number of posts allowed per day
  numberOfPosts: { type: Number, default: 1 }, // Number of posts per trigger
  usageCount: { type: Number, default: 0 }, // Number of posts generated today
  monthlyUsageCount: { type: Number, default: 0 }, // Number of posts generated this month
  lastUsed: { type: Date, default: Date.now },
  customSchedule: { type: [String], default: [] }, // Custom times for video generation (e.g., ["10:00", "14:00"])
});

module.exports = mongoose.model("User", UserSchema);

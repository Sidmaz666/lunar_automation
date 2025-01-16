require("dotenv").config();

module.exports = {
  MONGO_URI: process.env.MONGO_URI,
  TOGETHER_AI_API_KEY: process.env.TOGETHER_AI_API_KEY,
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  email: process.env.GOOGLE_EMAIL,
  DEEPTALK_EMAIL: process.env.DEEPTALK_EMAIL,
  DEEPTALK_PASSWORD: process.env.DEEPTALK_PASSWORD,
  MASTER_KEY: process.env.MASTER_KEY
};

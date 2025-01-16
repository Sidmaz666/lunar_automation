const cron = require("node-cron");
const User = require("../models/User");
const VideoService = require("../lib/VideoService");
const logger = require("./logger");
const { TOGETHER_AI_API_KEY, APP_URL } = require("../config");
const axios = require("axios");


// Define user rules
const userRules = {
  free: {
    isBilled: false,
    limits: {
      dailyLimit: 2, // Posts per day
      numberOfPostsPerSession: 1, // Posts per session
      monthlyUsageLimit: 30, // 1 post per day * 1 post per session * 30 days
    },
  },
  basic: {
    isBilled: true,
    limits: {
      dailyLimit: 5,
      numberOfPostsPerSession: 2,
      monthlyUsageLimit: 300, // 5 posts per day * 2 posts per session * 30 days
    },
  },
  pro: {
    isBilled: true,
    limits: {
      dailyLimit: 10,
      numberOfPostsPerSession: 3,
      monthlyUsageLimit: 900, // 10 posts per day * 3 posts per session * 30 days
    },
  },
};

const cronJobs = () => {
  // Ping server every 14 minutes to keep it alive
  cron.schedule("*/14 * * * *", async () => {
    logger.info("Pinging server to keep it alive...");
    // Add your ping endpoint here
    const { data } = await axios.get(APP_URL);

    if (!data) {
      logger.error("Failed to ping server.");
    } else {
      logger.info("Server pinged successfully.");
    }
  });

  // Video generation cron job (runs at specific intervals)
  cron.schedule("0 10,14,18,22 * * *", async () => {
    logger.info("Running video generation cron job...");

    try {
      const users = await User.find({});

      for (const user of users) {
        const userType = user.accountType;
        const rules = userRules[userType];

        // Validate billing status
        if (rules.isBilled !== user.isBilled) {
          logger.warn(
            `Skipping user ${user.username}: Billing status mismatch. Expected ${rules.isBilled}, found ${user.isBilled}.`
          );
          continue;
        }

        // Validate Instagram credentials
        if (
          !user.instagramCredentials.username ||
          !user.instagramCredentials.password
        ) {
          logger.warn(
            `Skipping user ${user.username}: Missing Instagram credentials.`
          );
          continue;
        }

        // Use Together API key from .env if user hasn't provided one
        const togetherApiKey = user.togetherApiKey || TOGETHER_AI_API_KEY;
        if (!togetherApiKey) {
          logger.warn(
            `Skipping user ${user.username}: Missing Together API key.`
          );
          continue;
        }

        // Determine the limits based on whether the user has a Together API key
        const dailyLimit = rules.limits.dailyLimit;
        const monthlyLimit = rules.limits.monthlyUsageLimit;
        const numberOfPostsPerSession = rules.limits.numberOfPostsPerSession;

        // Check if user has reached daily limit
        if (user.usageCount >= dailyLimit) {
          logger.info(`User ${user.username} has reached their daily limit.`);
          continue;
        }

        // Check if user has reached monthly limit
        if (user.monthlyUsageCount >= monthlyLimit) {
          logger.info(`User ${user.username} has reached their monthly limit.`);
          continue;
        }

        // Use custom schedule if available, otherwise use app default
        const schedule =
          user.customSchedule.length > 0
            ? user.customSchedule
            : ["10:00", "14:00", "18:00", "22:00"];
        const currentTime = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });

        if (schedule.includes(currentTime)) {
          const videoService = new VideoService({
            ...user.toObject(),
          });

          // Generate videos based on the number of posts per session
          for (let i = 0; i < numberOfPostsPerSession; i++) {
            // Check if the user has reached their daily or monthly limit during the session
            if (
              user.usageCount >= dailyLimit ||
              user.monthlyUsageCount >= monthlyLimit
            ) {
              logger.info(
                `User ${user.username} has reached their limit during the session.`
              );
              break;
            }

            const jsonData = await videoService.postVideoToInstagram();

            // Update user's usage count
            user.usageCount += 1;
            user.monthlyUsageCount += 1;
            user.lastUsed = new Date();
	    user.videos = [...user.videos, jsonData ];
            await user.save();

            logger.info(
              `Video generated and uploaded for user ${user.username}.`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error in video generation cron job: ${error.message}`);
    }
  });

  // Reset daily usage count at midnight
  cron.schedule("0 0 * * *", async () => {
    await User.updateMany({}, { $set: { usageCount: 0 } });
    logger.info("Daily usage counts reset.");
  });

  // Reset monthly usage count at the start of each month
  cron.schedule("0 0 1 * *", async () => {
    await User.updateMany({}, { $set: { monthlyUsageCount: 0 } });
    logger.info("Monthly usage counts reset.");
  });
};

module.exports = cronJobs;

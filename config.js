require("dotenv").config();

const niches = ["Anime", "Manga"];

const credentials = {
  instagram: {
    username: process.env.INSTAGRAM_USERNAME,
    password: process.env.INSTAGRAM_PASSWORD,
  },
  youtube: {
    email: process.env.YOUTUBE_EMAIL,
    password: process.env.YOUTUBE_PASSWORD,
    api_key: process.env.YOUTUBE_API_KEY,
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
    access_token: process.env.YOUTUBE_ACCESS_TOKEN,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  },
};

const numberOfPosts = 1;

module.exports = {
  niches,
  credentials,
  numberOfPosts,
};

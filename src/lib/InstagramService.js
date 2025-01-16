const Instagram = require("instagram-private-api").IgApiClient;
const fs = require("fs");
const path = require("path");

class InstagramService {
  constructor(user) {
    this.user = user;
    this.ig = new Instagram();
    this.ig.state.generateDevice(user.instagramCredentials.username);
  }

  async loginToInstagram() {
    try {
      console.log("Logging in to Instagram...", {user:this.user});
      const loggedInUser = await this.ig.account.login(
        this.user.instagramCredentials.username,
        this.user.instagramCredentials.password
      );
      console.log("Logged in as:", loggedInUser.username);
      return loggedInUser;
    } catch (error) {
      console.error("Error logging in to Instagram:", error);
      throw error;
    }
  }

  async uploadInstagramReel(videoPath, caption, hashtags) {
    try {
      await this.loginToInstagram();

      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      const videoBuffer = fs.readFileSync(videoPath);
      const fullCaption = `${caption}\n\n${hashtags.join(" ")}`;

       await this.ig.publish.video({
        video: videoBuffer,
        caption: fullCaption,
        coverImage: fs.readFileSync(path.join(path.dirname(videoPath), "images", "image_1.jpg")),
        width: 1080,
        height: 1920,
      });
      console.log("Instagram Reel uploaded successfully");
    } catch (error) {
      console.warn("Something went wrong while uploading to Instagram! Probably it's a bug! :)");
    }
  }
}

module.exports = InstagramService;

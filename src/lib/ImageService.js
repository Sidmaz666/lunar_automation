const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ImageService {
  constructor(together) {
    this.together = together;
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async generateImages(prompts, outputDir) {
    const images = [];
    const imgDir = path.join(outputDir);

    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }

    const modified_prompts = prompts.slice(0, 9);

    for (const prompt of modified_prompts) {
      let retries = 10; // Increased max retries
      while (retries > 0) {
        try {
          console.log(`Generating image for prompt: ${prompt}`);
          const response = await this.together.images.create({
            model: "black-forest-labs/FLUX.1-schnell-Free",
            prompt: prompt,
            width: 1024,
            height: 1024,
            steps: 4,
            n: 1,
          });

          console.log('API Response:', response); // Log the entire response

          if (!response || !response.data) {
            throw new Error("Invalid API response: No data found.");
          }

          const imageUrl = response.data[0]?.url;
          if (!imageUrl) {
            throw new Error("No image URL found in the Together API response.");
          }

          console.log(`Downloading image from URL: ${imageUrl}`);
          const imagePath = path.join(imgDir, `image_${images.length + 1}.jpg`);
          const imageResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
          });

          fs.writeFileSync(imagePath, imageResponse.data);
          images.push(imagePath);
          console.log(`Image saved successfully: ${imagePath}`);

          await this.delay(2000); // Add a 2-second delay after each request
          break; // Exit retry loop on success
        } catch (error) {
          console.error(`Error generating image for prompt: ${prompt}. Retries left: ${retries - 1}`, error);
          retries--;
          if (retries === 0) {
            console.error(`Max retries reached for prompt: ${prompt}. Skipping...`);
          }
        }
      }
    }

    return images;
  }
}

module.exports = ImageService;

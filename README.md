# Lunar Automation

Lunar Automation is a robust Node.js-based solution designed to automate the creation and posting of engaging video content on Instagram. By leveraging cutting-edge AI technologies such as **Deepseek** for content generation, **Flux** for image creation, **TTSMP3** for text-to-speech conversion, and **FFmpeg** for video editing, Lunar Automation empowers users to produce high-quality, niche-specific videos with minimal manual intervention. The program utilizes a highly detailed JSON configuration to define video structure, ensuring a seamless and customizable content creation process.

---

## Key Features

- **AI-Driven Content Generation**: Utilizes **Deepseek** to generate detailed and engaging video scripts tailored to specific niches.
- **Dynamic Image Creation**: Leverages **Flux** to produce high-quality images based on meticulously crafted prompts.
- **Text-to-Speech Integration**: Employs **TTSMP3** to convert text into natural-sounding voiceovers for video narration.
- **Video Assembly with FFmpeg**: Combines images, audio, and transitions using **FFmpeg** to create polished, professional videos.
- **Customizable JSON Configuration**: Allows users to define video structure, content, and styling through a detailed JSON schema.
- **Automated Instagram Posting**: Automates the process of uploading generated videos to Instagram, saving time and effort.

---

## Acknowledgments

We extend our heartfelt gratitude to the following services and contributors for their invaluable support in making Lunar Automation possible:

- **TTSMP3**: For providing high-quality text-to-speech services that bring our video narrations to life.
- **Deepseek**: For enabling advanced content generation that forms the backbone of our video scripts.
- **TogetherAI**: For making **Flux** image generation accessible and free, allowing us to create stunning visuals effortlessly.
- **All Contributors**: For their dedication and contributions to the project, helping us refine and enhance Lunar Automation.

---

## How It Works

1. **Content Generation**: The system generates a comprehensive JSON file using **Deepseek**, outlining the video's title, hook, caption, segments, dialogue, image prompts, transitions, and other metadata.
2. **Image Creation**: **Flux** generates visually compelling images based on the prompts specified in the JSON file.
3. **Text-to-Speech Conversion**: **TTSMP3** converts the dialogue into high-quality audio files for narration.
4. **Video Assembly**: **FFmpeg** stitches together the generated images, audio, and transitions to produce the final video.
5. **Instagram Posting**: The program automatically uploads the completed video to Instagram, complete with captions and hashtags.

---

## Example JSON Configuration

Below is an example of the JSON configuration used to generate a video:

```json
{
  "niche": "Manga",
  "topic": "Your Manga Alter Ego Based on Your Zodiac Sign",
  "random_seed": 701610,
  "video": {
    "title": "Unleash Your Inner Manga Hero: Zodiac Edition!",
    "hook": "What if your zodiac sign held the key to your manga alter ego? Let’s find out! <break time=\"1s\"/>",
    "caption": "Discover your manga alter ego based on your zodiac sign! From fiery Aries warriors to dreamy Pisces mages, find out which manga character you’re destined to be. Share your results in the comments!",
    "layout": [
      {
        "id": "segment1",
        "timestamp": "00:00:00",
        "segment_title": "Aries: The Fiery Warrior",
        "dialogue": [
          "Aries, you’re the <emphasis level=\"strong\">unstoppable force</emphasis> of the zodiac!",
          "Your manga alter ego? A fearless warrior with a flaming sword. <break time=\"1s\"/>",
          "Ready to conquer the battlefield!"
        ],
        "images": [
          {
            "id": "image1",
            "prompt": "A fiery battlefield with a warrior in red armor wielding a flaming sword. The color palette is dominated by reds and oranges, with high contrast and vibrant saturation. The artistic style is shonen manga, with dynamic textures and detailed flames. The environment is intense and action-packed, with a smoky background and glowing embers in the foreground.",
            "duration": 4,
            "start_time": "00:00:00",
            "end_time": "00:00:04"
          }
        ],
        "transition": "fade"
      },
      // Additional segments...
    ],
    "music_type": "epic",
    "hashtags": [
      "#MangaAlterEgo",
      "#ZodiacManga",
      "#AnimeLovers",
      "#MangaArt",
      "#ZodiacSigns",
      "#AnimeCommunity"
    ]
  }
}
```

---

## Environment Variables

To run Lunar Automation, you need to configure the following environment variables in a `.env` file:

```env
DEEPTALK_EMAIL=your_deeptalk_email
DEEPTALK_PASSWORD=your_deeptalk_password
TOGETHER_AI_API_KEY=your_together_ai_api_key
MONGO_URI=your_mongodb_uri
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
GOOGLE_EMAIL=your_google_email
MASTER_KEY=your_master_key
```

---

## Application Routes

The `app.js` file defines the following routes:

1. **`GET /`**: A health check endpoint to verify that the server is running.
   - **Response**: Returns a JSON object with a success message.

2. **`POST /generate_video`**: Initiates the video generation process.
   - **Request Body**:
     - `user`: The user initiating the request.
     - `app_master_key`: The master key for authentication.
     - `additionalConfig`: Optional configuration for video generation.
   - **Response**: Returns a JSON object with an `eventId` and a message indicating that video generation has started.

3. **`GET /events/:eventId`**: Provides Server-Sent Events (SSE) for real-time logging of video generation progress.
   - **Response**: Streams logs and status updates for the specified `eventId`.

---

## User Object for Video Generation

The `generate_video` endpoint requires a `user` object in the request body. This object contains essential information about the user and their preferences for video generation. Below is an example of the `user` object structure:

```json
{
  "user": {
    "username": "example_username",
    "email": "example_email@example.com",
    "niche": [
      "Legendary Rings/Ornaments (Can be from any Era/Dimension/fantasy/universe/world) based on zodiac",
      "Legendary Weapon (Can be from any Era) based on Birth Month",
      "Quirks (Super Powers From Anime: My Hero Academia) based on birth month",
      "You beat the final boss (Can be from any world/dimension/universe), which bedroom are you choosing?",
      "Choose Final Boss (Final Bosses: 5, Can be from any world/dimension/universe)",
      "Anime nickname based on birth month",
      "Choose your companion (Can be from any creature from world/dimension/universe)",
      "Which mythical creature (Can be from any creature from world/dimension/universe) are you choosing?"
    ],
    "accountType": "pro",
    "numberOfPosts": 1,
    "instagramCredentials": {
      "username": "example_instagram_username",
      "password": "example_instagram_password"
    }
  },
  "app_master_key": "your_master_key"
}
```

### Key Fields in the User Object

- **`username`**: The username of the user initiating the video generation.
- **`email`**: The email address associated with the user.
- **`niche`**: An array of niche topics that define the type of content the user wants to generate. These topics guide the AI in creating relevant and engaging video scripts.
- **`accountType`**: Specifies the user's account type (e.g., `pro`). This can be used to determine access to advanced features or higher usage limits.
- **`numberOfPosts`**: The number of posts the user wants to generate in this request.
- **`instagramCredentials`**: Contains the Instagram username and password for the account where the video will be posted.
- **`app_master_key`**: A secure key used to authenticate the request and ensure that only authorized users can initiate video generation.

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/lunar-automation.git
   cd lunar-automation
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and populate it with the necessary credentials.

4. **Run the Application**:
   ```bash
   npm start
   ```

---

## Contributing

We welcome contributions from the community. To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a detailed description of your changes.

---

## License

This project is licensed under the MIT License. For more details, refer to the [LICENSE](LICENSE) file.

---

## Support

For assistance or to report issues, please open an issue on the [GitHub repository](https://github.com/yourusername/lunar-automation/issues).

---

Lunar Automation empowers users to create and share compelling Instagram content with ease, leveraging the latest advancements in AI and automation. Explore the possibilities and elevate your social media presence today. 🚀

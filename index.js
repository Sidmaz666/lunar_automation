const Together = require("together-ai");
var gtts = require("node-gtts")("en");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { niches, credentials, numberOfPosts } = require("./config");
const Instagram = require("instagram-private-api").IgApiClient;

require("dotenv").config();

const together_api_key = process.env.TOGETHER_AI_API_KEY;

const together = new Together({
  apiKey: together_api_key,
});

if (!together_api_key) {
  console.error("Please set the TOGETHER_AI_API_KEY environment variable");
  process.exit(1);
}

// Instagram Client
const ig = new Instagram();
ig.state.generateDevice(credentials.instagram.username);


// Helper function to delay execution
function delay(ms, message) {
  console.warn(`=> Waiting ${ms}ms...`);
  if (message) console.info(message);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Instagram Login and Upload
async function loginToInstagram() {
  try {
    console.log("Logging in to Instagram...");

    const loggedInUser = await ig.account.login(
      credentials.instagram.username,
      credentials.instagram.password
    );
    console.log("Logged in as:", loggedInUser.username);

    return loggedInUser;
  } catch (error) {
    console.error("Error logging in to Instagram:", error);
    throw error;
  }
}

async function uploadInstagramReel(videoPath, caption, tags, hashtags) {
  try {
    await loginToInstagram();

    // Validate video file
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const fullCaption = `${caption}\n\n${tags.join(" ")}\n\n${hashtags.join(
      " "
    )}`;

    const publishResult = await ig.publish.video({
      video: videoBuffer,
      caption: fullCaption,
      coverImage: fs.readFileSync(
        path.join(path.dirname(videoPath), "img", "image_1.jpg")
      ),
      width: 1080,
      height: 1920,
    });

    console.log("Instagram Reel uploaded successfully:", publishResult);
    return publishResult;
  } catch (error) {
    console.error("Error uploading Instagram Reel:", error);
    throw error;
  }
}

// Parse metadata.txt
function parseMetadata(metadata) {
  try {
    const [caption, tagsLine, hashtagsLine] = metadata
      .split("\n")
      .filter((line) => line.trim() !== "");
    const tags = tagsLine.replace("Tags: ", "").split(", ");
    const hashtags = hashtagsLine.replace("Hashtags: ", "").split(" ");
    return { caption, tags, hashtags };
  } catch (error) {
    console.error("Error parsing metadata:", error);
    throw new Error("Invalid metadata format.");
  }
}

// Step 1: Select a random niche and generate a topic
async function selectNicheAndGenerateTopic() {
  const niche = niches[Math.floor(Math.random() * niches.length)];

  const prompt = `
  **Task:** Generate a highly engaging and interactive topic related to ${niche} for a short-form video (Instagram Reel or YouTube Short). The topic should be thought-provoking, humorous, and tailored for a young, social media-savvy audience.

  **Requirements:**
  1. The topic must be concise and directly related to ${niche}.
  2. Include relevant keywords and details to make the topic engaging.
  3. Do not include any introductory text like "Here's a topic related to...". Only provide the topic and its details.

  **Example Output:**
  "Top 5 Underrated Anime Soundtracks You Need to Hear! Keywords: anime music, J-pop, J-rock, underrated gems, anime culture."

  **Example Output:**
  "Which Anime Character are you based on your Zodiac Sign? Keyword: anime, zodiac, manga, gems, culture."
  
  **Example Output:**
  "Which Character are you taking on your journey to {Legendary Place}? Keywords: anime, adventure, manga, gems, culture."


  **Your Response (Only the topic and keywords):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  const topic = response.choices[0].message.content.trim();
  return { niche, topic };
}

// Step 2: Generate Content
async function generateContent(niche, topic) {
  const prompt = `
  **Task:** Create a unique and engaging social media content idea for ${niche} based on the topic: ${topic}. The content should be interactive, humorous, and formatted as a question followed by points/options/answers.

  **Requirements:**
  1. The content must be suitable for a 15-30 second video.
  2. Start with a question, followed by 3-5 points/options/answers.
  3. Maintain a humorous and engaging tone throughout.
  4. Do not include any introductory text like "Here's a content idea...". Only provide the content.

  **Example Output:**
  "Which Anime Character Would Win in a Dance Battle? 
  1. Naruto with his Shadow Clone Jutsu moves.
  2. Goku breaking the floor with his Super Saiyan energy.
  3. Sailor Moon twirling with her magical wand.
  4. Levi Ackerman with his precise Titan-slaying moves."

  **Example Output:**
  "Which Anime Character is powerful in all verses? 
  1. Naruto.
  2. Goku.
  3. Saitama.
  4. Shanks

  **Your Response (Only the content):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  return response.choices[0].message.content;
}

// Step 3: Generate Script
async function generateScript(content) {
  const prompt = `
  **Task:** Generate a detailed script for a 15-30 second video based on the following content: ${content}. The script should be concise, engaging, and humorous.

  **Requirements:**
  1. The script must be between 15-30 seconds in length.
  2. Include an introduction, followed by 3-5 points, and a conclusion.
  3. Do not ask for likes, comments, or shares. Only ask for opinions or thoughts.
  4. Avoid promotional or sponsored language.
  5. Do not include any introductory text like "Here's the script...". Only provide the script.
  6. Should Have a Time sections, format: (0s-4s) Image 1: {Image Description} .


  **Example Output:**
  (0s-10s) Image 1: {Image Description}.
  "Goku from Dragon Ball Z."
  (11s-14s) Image 2: {Image Description}.
  "Naruto Uzumaki from Naruto."
  (15s-20s) Image 3: {Image Description}.
  "Saitama from One Punch Man."
  (20s-30s) Image 4: {Image Description}.
  "Shanks from One Piece."


  **Example Output:**
  (0s-4s) Image 1: {Image Description}.
  "Think you know anime? Let’s settle this! Who would win in a dance battle? Naruto with his Shadow Clone Jutsu moves? Goku breaking the floor with his Super Saiyan energy? Or Sailor Moon twirling with her magical wand? Drop your pick in the comments!"

  **Your Response (Only the script):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  return response.choices[0].message.content;
}

// Step 4: Generate Image Prompts
async function generateImagePrompts(script) {
  const prompt = `
  **Task:** Generate image prompts based on the following script: ${script}. Each prompt should describe an image that visually represents a point in the script.

  **Requirements:**
  1. The first prompt should represent the introduction/question.
  2. Each prompt should be concise and visually descriptive.
  3. Do not include any text, titles, or headings in the image prompts.
  4. Do not include any introductory text like "Here are the image prompts...". Only provide the prompts.
  5. Ensure the Image Prompt have tons of visual contexts from the script, if it is not their add contexts to it based on the script.

  **Example Output:**
  1. A vibrant anime character dancing energetically - from One Piece, Death Note.
  2. Naruto performing Shadow Clone Jutsu on a dance floor - from Naruto.
  3. Goku in Super Saiyan mode breaking the floor with his energy - from Dragon Ball Z.
  4. Akainu Killing Ace from One Piece, Ace is Luffy's brother.

  **Your Response (Only the image prompts):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  return response.choices[0].message.content
    .split("\n")
    .filter((p) => p.trim() !== "")
    .map((e) => e?.replace(/[0-9]/, "")?.replace(/. /, "")?.trim());
}

// Step 5: Generate Audio Script
async function generateAudioScript(script) {
  const prompt = `
  **Task:** Generate a transcript for the Google TTS service based on the following script: ${script}.

  **Requirements:**
  1. The transcript must align with the timeframe sections of the script.
  2. The tone should be humorous, energetic, and engaging.
  3. The transcript must be less than or equal to 3,000 characters.
  4. Do not include any introductory text like "Here's the transcript...". Only provide the raw transcript.

  **Instructions|Information|Context:**
  - The script has timeframe sections (e.g., 0s-4s, 5s-8s, etc.), and the transcript must align with these sections.
  - The transcript should be divided into chunks that blend into the timeframe of the script.
  - Use punctuation and formatting tricks to control pauses, emphasis, speed, pitch, and tone.
  - Use ellipses (...) or commas with dots (,...) for pauses.
  - Use exclamation marks (!) or question marks (?) for emphasis and pitch changes.
  - Use capitalization for strong emphasis.
  - Use line breaks (\n) to separate chunks according to the script's timeframe.
  - Ensure the transcript is dynamic and engaging, with a humorous and energetic tone.
  - Do not include any introductory text like "Here's the transcript...". Only provide the raw transcript.

  **Example Script with Timeframe Sections:**
  (0s-4s) Image 1: An anime-style montage of various manga characters.
  "What happens when anime legends join forces? Let's imagine the ultimate superhero team-up!

  (5s-8s) Image 2: Luffy and Goku facing off in a massive energy battle.
  "Luffy from One Piece and Goku teaming up? Who would win in a massive energy battle? Luffy's rubber powers vs Goku's Kamehameha wave. The fight would be EPIC!

  (9s-12s) Image 3: Edward Elric trading powers with the Straw Hat Pirates' crew.
  "Edward Elric from Fullmetal Alchemist trading powers with the Straw Hat Pirates? Chaos ensues! Luffy's rubber powers on Edward's arm? Don't even get me started!

  (13s-16s) Image 4: Light Yagami and Akuma in a strategic battle of wits.
  "Light Yagami from Death Note teaming up with Akuma from Street Fighter? Who would win in a strategic battle of wits? The genius of Light vs the beastly power of Akuma.

  (17s-20s) Image 5: Goku and Lelouch joining forces.
  "Goku and Lelouch from Code Geass joining forces? Unstoppable duo or clash of egos? Goku's energy vs Lelouch's strategic mind. The possibilities are endless!

  (21s-25s) Image 6: A split-screen comparison of the different teams.
  "So, which team would you root for? Let us know in the comments! Who do you think would emerge victorious in this epic anime showdown?"

  **Example Response (Raw Transcript):**
  What happens,...... when anime legends join forces!?  
  Let’s imagine,...... the ultimate superhero team-up!!!

  Luffy from One Piece,...... and Goku teaming up!?  
  Who would win,...... in a MASSIVE energy battle!?  
  Luffy’s rubber powers,...... vs Goku’s Kamehameha wave......  
  The fight would be,...... EPIC!!!

  Edward Elric,...... from Fullmetal Alchemist,...... trading powers with the Straw Hat Pirates!?  
  Chaos ensues!!!  
  Luffy’s rubber powers,...... on Edward’s arm!?  
  Don’t even,...... get me started!!!

  Light Yagami,...... from Death Note,...... teaming up with Akuma from Street Fighter!?  
  Who would win,...... in a strategic battle of wits!?  
  The genius of Light,...... vs the beastly power of Akuma!!!

  Goku,...... and Lelouch from Code Geass,...... joining forces!?  
  Unstoppable duo,...... or clash of egos!?  
  Goku’s energy,...... vs Lelouch’s strategic mind......  
  The possibilities,...... are endless!!!

  So,...... which team would you root for!?  
  Let us know,...... in the comments!!!  
  Who do you think,...... would emerge victorious,...... in this epic anime showdown!?


  Note: Do not include any introductory text like "Here's the transcript...". Only provide the raw transcript.

  **Your Response (Only the raw transcript):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  return response.choices[0].message.content?.trim();
}

// Step 6: Generate Images with Rate Limit Delay
async function generateImages(prompts, outputDir) {
  const images = [];
  const imgDir = path.join(outputDir, "img");

  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  const modified_prompts = prompts.slice(0, 9);

  for (const prompt of modified_prompts) {
    try {
      const response = await together.images.create({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt: `${prompt}. 
        Please make the image vibrant and visually distinct!
        IMPORTANT: The image should not have any text, except for meaningful background text in English.`,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error("No image URL found in the Together API response.");
      }

      const imagePath = path.join(imgDir, `image_${images.length + 1}.jpg`);
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      fs.writeFileSync(imagePath, imageResponse.data);
      images.push(imagePath);
    } catch (error) {
      console.error(`Error generating image for prompt: ${prompt}`, error);
    }
    await delay(10000, `Generated Image for Prompt => ${prompt}`);
  }

  return images;
}

// Step 7: Generate Audio using TTS
async function generateAudio(script, outputDir) {
  try {
    const audioFilePath = path.join(outputDir, "output.mp3");

    await new Promise((resolve, reject) => {
      gtts.save(audioFilePath, script, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return audioFilePath;
  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
}

// Step 8: Combine Everything with FFMPEG
async function createVideo(images, audioFile, script, transcript, outputDir) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No images provided.");
  }
  if (!audioFile || typeof audioFile !== "string") {
    throw new Error("Invalid audio file path.");
  }
  if (!script || typeof script !== "string") {
    throw new Error("Invalid script provided.");
  }
  if (!transcript || typeof transcript !== "string") {
    throw new Error("Invalid transcript provided.");
  }
  if (!outputDir || typeof outputDir !== "string") {
    throw new Error("Invalid output directory.");
  }

  if (!fs.existsSync(audioFile)) {
    throw new Error(`Audio file not found: ${audioFile}`);
  }

  let durations = await parseScriptForDurations(script);

  if (durations.length < images.length) {
    const defaultDuration = 5;
    const remainingDurations = Array(images.length - durations.length).fill(
      defaultDuration
    );
    durations = durations.concat(remainingDurations);
  }

  if (durations.length > images.length) {
    durations = durations.slice(0, images.length);
  }

  const audioDuration = await getAudioDuration(audioFile);
  const totalImageDuration = durations.reduce(
    (sum, duration) => sum + duration,
    0
  );

  if (audioDuration < totalImageDuration) {
    const scaleFactor = audioDuration / totalImageDuration;
    durations = durations.map((duration) => duration * scaleFactor);
  }

  const totalAdjustedDuration = durations
    .slice(0, -1)
    .reduce((sum, duration) => sum + duration, 0);
  durations[durations.length - 1] = audioDuration - totalAdjustedDuration;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const concatFilePath = path.join(outputDir, "concat.txt");
  const concatFileContent = images
    .map((image, index) => `file '${image}'\nduration ${durations[index]}`)
    .join("\n");

  try {
    fs.writeFileSync(concatFilePath, concatFileContent);
  } catch (err) {
    throw new Error(`Failed to write concat file: ${err.message}`);
  }

  const videoWithoutSubtitles = path.join(
    outputDir,
    "video_without_subtitles.mp4"
  );
  await createVideoWithoutSubtitles(
    concatFilePath,
    audioFile,
    videoWithoutSubtitles
  );

  const subtitlesFilePath = path.join(outputDir, "subtitles.srt");
  const subtitles = await generateSubtitles(transcript, durations);
  try {
    fs.writeFileSync(subtitlesFilePath, subtitles);
  } catch (err) {
    throw new Error(`Failed to write subtitles file: ${err.message}`);
  }

  const finalVideoPath = path.join(outputDir, "output.mp4");
  const sanitizedFinalVideoPath = finalVideoPath.replace(
    /[^a-zA-Z0-9_\-./]/g,
    "_"
  );

  try {
    await addSubtitlesToVideo(
      videoWithoutSubtitles,
      subtitlesFilePath,
      sanitizedFinalVideoPath
    );
  } catch (err) {
    throw new Error(`Failed to add subtitles to video: ${err.message}`);
  }

  try {
    fs.unlinkSync(concatFilePath);
    //fs.unlinkSync(subtitlesFilePath);
    //fs.unlinkSync(videoWithoutSubtitles);
  } catch (err) {
    console.error("Failed to delete temporary files:", err);
  }

  return sanitizedFinalVideoPath;
}

async function slowDownAudio(inputFile, outputFile, speedFactor) {
  return new Promise((resolve, reject) => {
    const isSameFile = inputFile === outputFile;
    let tempInputFile = inputFile;

    // If input and output files are the same, rename the original file to a temporary name
    if (isSameFile) {
      const ext = path.extname(inputFile); // Get the file extension
      const baseName = path.basename(inputFile, ext); // Get the file name without extension
      tempInputFile = `${baseName}_temp${ext}`; // Create a temporary file name

      try {
        fs.renameSync(inputFile, tempInputFile); // Rename the original file to the temporary file
        console.log(
          `Renamed original file to temporary file: ${tempInputFile}`
        );
      } catch (err) {
        reject(new Error(`Failed to rename original file: ${err.message}`));
        return;
      }
    }

    // Slow down the audio using ffmpeg
    ffmpeg(tempInputFile)
      .audioFilters(`atempo=${speedFactor}`) // Apply the atempo filter to change speed
      .on("start", (commandLine) => {
        console.log(`Spawned FFmpeg with command: ${commandLine}`);
      })
      .on("progress", (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on("end", () => {
        console.log("Processing finished!");

        // If input and output files are the same, delete the temporary input file
        if (isSameFile) {
          try {
            fs.unlinkSync(tempInputFile); // Delete the temporary input file
            console.log(`Deleted temporary file: ${tempInputFile}`);
          } catch (err) {
            reject(
              new Error(`Failed to delete temporary file: ${err.message}`)
            );
            return;
          }
        }

        resolve(); // Resolve the promise when processing is complete
      })
      .on("error", (err) => {
        console.error("Error occurred:", err);

        // If input and output files are the same, restore the original file name on error
        if (isSameFile) {
          try {
            fs.renameSync(tempInputFile, inputFile); // Restore the original file name
            console.log(`Restored original file: ${inputFile}`);
          } catch (renameErr) {
            console.error(
              `Failed to restore original file: ${renameErr.message}`
            );
          }
        }

        reject(err); // Reject the promise if an error occurs
      })
      .save(outputFile); // Save to the output file
  });
}

// Helper function to create a video without subtitles
function createVideoWithoutSubtitles(concatFilePath, audioFile, outputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputFormat("concat")
      .inputOptions(["-safe", "0"])
      .input(audioFile)
      .outputOptions(["-c:v libx264", "-c:a aac", "-strict experimental"])
      .output(outputFile)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

// Helper function to add subtitles to the video
function addSubtitlesToVideo(inputVideo, subtitlesFilePath, outputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputVideo)
      .input(subtitlesFilePath)
      .outputOptions([
        "-c:v libx264",
        "-c:a aac",
        `-vf subtitles=${subtitlesFilePath}`,
        "-strict experimental",
      ])
      .output(outputFile)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

// Function to parse the script and extract image durations
async function parseScriptForDurations(script) {
  const prompt = `
  You are a helpful assistant that extracts image durations from a script. The script describes a sequence of images and their corresponding durations. Your task is to analyze the script and extract the duration (in seconds) for each image.

  **Rules for your response:**
  1. Return **only a JSON array of numbers** representing the durations in seconds.
  2. Do not include any additional text, explanations, or formatting.
  3. Ensure the JSON array is valid and can be directly parsed by \`JSON.parse()\`.
  4. If the script does not explicitly specify durations, infer reasonable durations based on the context.
  5. If no durations can be inferred, return an empty array \`[]\`.

  **Example 1:**
  Script:
  """
  (0s-5s) Image 1: A cat sitting on a mat.
  (5s-10s) Image 2: A dog playing in the park.
  (10s-15s) Image 3: A bird flying in the sky.
  """

  Output:
  [5, 5, 5]

  **Example 2:**
  Script:
  """
  (0s-3s) Image 1: A sunrise over the mountains.
  (3s-7s) Image 2: A river flowing through a forest.
  (7s-12s) Image 3: A city skyline at night.
  """

  Output:
  [3, 4, 5]

  **Example 3:**
  Script:
  """
  This script describes a sequence of images but does not specify durations.
  """

  Output:
  []

  **Script to analyze:**
  """
  ${script}
  """

  **Your response (ONLY a JSON array of numbers):**
  `;

  try {
    const response = await together.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "meta-llama/Llama-Vision-Free",
    });

    const content = response.choices[0].message.content;
    const durations = JSON.parse(content);

    if (
      !Array.isArray(durations) ||
      !durations.every((d) => typeof d === "number")
    ) {
      throw new Error("AI returned invalid durations format.");
    }

    return durations;
  } catch (err) {
    console.error("Failed to parse script for durations using AI:", err);
    return []; // Return an empty array if parsing fails
  }
}

// Helper function to generate subtitles in .srt format
async function generateSubtitles(transcript, durations) {
  // If the transcript is not split into lines, split it into meaningful lines
  if (!transcript.includes("\n")) {
    const prompt = `
    **Task:** Split the following transcript into meaningful lines for subtitles. Each line should be concise and suitable for a 15-30 second video.

    **Transcript:**
    ${transcript}

    **Requirements:**
    1. Split the transcript into lines that are easy to read and fit within the video's timeframe.
    2. Each line should be a complete thought or sentence.
    3. Do not include any introductory text like "Here are the lines...". Only provide the split lines.

    **Example Input:**
    "Think you know anime? Let’s settle this! Who would win in a dance battle? Naruto with his Shadow Clone Jutsu moves? Goku breaking the floor with his Super Saiyan energy? Or Sailor Moon twirling with her magical wand?"

    **Example Input:**
    Imagine you're... the leader of a superhero team. Who would you choose?

    First, you've got Lelouch, the strategic genius. But, is he too power-hungry to trust? ...

    Then, there's Light, the ultimate detective. His moral compass is a bit... questionable.

    But, Goku's kind heart and Super Saiyan powers make him a compelling choice. Can he keep it under control?

    Lastly, Roronoa Zoro brings his silent but deadly swordsmanship to the table. But, will he share the spotlight?

    Which one would you choose for your superhero team? Let us know your thoughts!


    **Example Output:**
    Think you know anime? Let’s settle this!
    Who would win in a dance battle?
    Naruto with his Shadow Clone Jutsu moves?
    Goku breaking the floor with his Super Saiyan energy?
    Or Sailor Moon twirling with her magical wand?

    **Example Output:**
    Imagine youre... the leader of a superhero team!
    Who would you choose?
    First, you've got Lelouch, the strategic genius. 
    But, is he too power-hungry to trust?
    Then, there's Light, the ultimate detective.
    His moral compass is a bit... questionable.

    **Your Response (Only the split lines):**
    `;

    const response = await together.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "meta-llama/Llama-Vision-Free",
    });

    transcript = response.choices[0].message.content.trim();
  }

  const lines = transcript.split("\n").filter((line) => line.trim() !== "");
  let subtitles = "";
  let startTime = 0;

  // Ensure durations array has the same length as the lines array
  if (durations.length < lines.length) {
    const defaultDuration = 5; // Default duration for each line
    durations = durations.concat(
      Array(lines.length - durations.length).fill(defaultDuration)
    );
  }

  lines.forEach((line, index) => {
    const endTime = startTime + durations[index];
    subtitles += `${index + 1}\n`;
    subtitles += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
    subtitles += `${line}\n\n`;
    startTime = endTime;
  });

  return subtitles;
}

// Helper function to format time in SRT format (HH:MM:SS,ms)
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(milliseconds, 3)}`;
}

// Helper function to pad numbers with leading zeros
function pad(num, length = 2) {
  return String(num).padStart(length, "0");
}

// Helper function to get the duration of an audio file
function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFile, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get audio duration: ${err.message}`));
      } else if (!metadata.format || !metadata.format.duration) {
        reject(new Error("Invalid audio file or duration not found."));
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

// Step 9: Generate Caption, Tags, and Hashtags
async function generateMetadata(script) {
  const prompt = `
  **Task:** Generate a caption, tags, and hashtags for a social media video based on the following script: ${script}.

  **Requirements:**
  1. The caption should be engaging and concise.
  2. Include 5-10 relevant tags and hashtags.
  3. Do not include any introductory text like "Here's the metadata...". Only provide the caption, tags, and hashtags.

  **Example Output:**
  "Caption: Think you know anime? Let’s settle this dance battle!
  Tags: anime, dance battle, Naruto, Goku, Sailor Moon
  Hashtags: #AnimeDance #NarutoVsGoku #AnimeLovers"

  **Your Response (Only the caption, tags, and hashtags):**
  `;

  const response = await together.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "meta-llama/Llama-Vision-Free",
  });

  return response.choices[0].message.content;
}

// Main Function
async function main() {
  const generatedVideos = [];

  for (let i = 0; i < numberOfPosts; i++) {
    try {
      const { niche, topic } = await selectNicheAndGenerateTopic();
      await delay(10000, `Selected Niche: ${niche}, Topic: ${topic}`);

      const folderName = `${Date.now()}_${niche
        ?.replaceAll(" ", "")
        ?.toLowerCase()}`;
      const outputDir = path.join(__dirname, folderName);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const content = await generateContent(niche, topic);
      await delay(10000, `Generated Content:\n ${content}`);
      fs.writeFileSync(path.join(outputDir, "content.txt"), content);

      const script = await generateScript(content);
      await delay(10000, `Generated Script:\n ${script}`);
      fs.writeFileSync(path.join(outputDir, "script.txt"), script);

      const imagePrompts = await generateImagePrompts(script);
      await delay(
        10000,
        `Generated Image Prompts:\n ${imagePrompts?.join("\n")}`
      );
      fs.writeFileSync(
        path.join(outputDir, "image_prompts.txt"),
        imagePrompts.join("\n")
      );

      const images = await generateImages(imagePrompts, outputDir);
      await delay(10000, `Generated Images:\n ${images?.join("\n")}`);

      const sanitizedScript = await generateAudioScript(script);
      await delay(10000, `Generated Audio Script:\n ${sanitizedScript}`);
      fs.writeFileSync(path.join(outputDir, "transcript.txt"), sanitizedScript);

      const audioFile = await generateAudio(sanitizedScript, outputDir);
      await delay(10000, `Generated Audio:\n ${audioFile}`);

      await slowDownAudio(audioFile, audioFile, 0.90);

      const finalVideoPath = await createVideo(
        images,
        audioFile,
        script,
        sanitizedScript,
        outputDir
      );
      await delay(10000, `Generated Video:\n ${finalVideoPath}`);

      const metadata = await generateMetadata(script);
      await delay(10000, `Generated Metadata:\n ${metadata}\n`);
      fs.writeFileSync(path.join(outputDir, "metadata.txt"), metadata);

      generatedVideos.push({ videoPath: finalVideoPath, outputDir });
    } catch (error) {
      console.error("Error in main process:", error);
    }
  }

  // Post generated videos to Instagram and YouTube
  for (const { videoPath, outputDir } of generatedVideos) {
    try {
      const metadata = fs.readFileSync(
        path.join(outputDir, "metadata.txt"),
        "utf8"
      );
      const { caption, tags, hashtags } = parseMetadata(metadata);

      // Upload to Instagram
       await uploadInstagramReel(
        videoPath,
        caption,
        tags,
        hashtags
      );
      console.log("Instagram Reel Uploaded:");
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  }
}

main()
  .catch((error) => {
    console.error("Main Error:", error);
    process.exit(1);
  })
  .finally(() => {
    console.log("Done!");
  });

const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const ImageService = require("./ImageService");
const TTSGenerator = require("./TTSGenerator");
const Together = require("together-ai");
const ffmpegPath = require("ffmpeg-static"); // Use ffmpeg-static
const ffprobe = require("ffprobe-static"); // Use ffprobe-static
const { TOGETHER_AI_API_KEY } = require("../config");

// Set the path to the ffmpeg and ffprobe binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

require("dotenv").config();
const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class VideoGenerator {
  constructor(jsonData) {
    if (!jsonData || !jsonData.video || !jsonData.video.title) {
      throw new Error(
        'Invalid JSON data: Missing required "video" or "video.title" property.'
      );
    }

    // Sanitize the video title to remove invalid characters
    this.sanitizedTitle = this.sanitizeFilename(jsonData.video.title);
    this.jsonData = jsonData;
    this.videoDir = path.join(__dirname, "videos", this.sanitizedTitle);
    this.segmentsDir = path.join(this.videoDir, "segments");
    this.imagesDir = path.join(this.videoDir, "images");
    this.audioDir = path.join(this.videoDir, "audio");
    this.subtitlesDir = path.join(this.videoDir, "subtitles");
    this.imageService = new ImageService(
      new Together({ apiKey: TOGETHER_AI_API_KEY })
    );
    this.ttsGenerator = new TTSGenerator(); // Initialize TTSGenerator
  }

  // Helper method to sanitize filenames
  sanitizeFilename(filename) {
    return filename
      .toLowerCase() // Convert to lowercase
      .replace(/\s+/g, "_") // Replace whitespace with underscores
      .replace(/[^a-z0-9_]/g, ""); // Remove all symbols and invalid characters
  }

  // Ensure all directories exist
  async ensureDirectories() {
    console.log("Ensuring directories exist...");
    await fse.ensureDir(this.videoDir);
    await fse.ensureDir(this.segmentsDir);
    await fse.ensureDir(this.imagesDir);
    await fse.ensureDir(this.audioDir);
    await fse.ensureDir(this.subtitlesDir);
    const jsonDataPath = path.join(this.videoDir, "video.json");
    fs.writeFileSync(jsonDataPath, JSON.stringify(this.jsonData, null, 2));
    console.log("Directories are ready.");
  }

  // Generate images based on prompts in JSON
  async generateImages() {
    console.log("Generating images...");
    const imagePrompts = this.jsonData.video.layout.flatMap((segment) =>
      segment.images.map((image) => image.prompt)
    );
    return await this.imageService.generateImages(imagePrompts, this.imagesDir);
  }

  // Generate audio for dialogues using TTS
  async generateAudio() {
    console.log("Generating audio...");
    const dialogues = this.jsonData.video.layout.flatMap(
      (segment) => segment.dialogue
    );
    const audioFiles = [];
    for (let i = 0; i < dialogues.length; i++) {
      const dialogue = dialogues[i];
      try {
        console.log(`Generating audio for dialogue: ${dialogue}`);
        const audioPath = path.join(this.audioDir, `audio_${i + 1}.mp3`);
        await this.ttsGenerator.generateAndDownloadTTS(
          dialogue,
          audioPath,
          "Matthew"
        ); // Use TTSGenerator
        console.log(`Audio saved successfully: ${audioPath}`);
        audioFiles.push({ dialogue, path: audioPath });
        await delay(3000);
      } catch (error) {
        console.error(
          `Failed to generate audio for dialogue "${dialogue}".`,
          error
        );
        // Skip this dialogue and continue with the next one
        continue;
      }
    }
    return audioFiles;
  }

  // Create subtitles for a segment
  async createSubtitles(segment, audioFiles) {
    console.log(`Creating subtitles for segment ${segment.id}...`);
    const subtitlesPath = path.join(this.subtitlesDir, `${segment.id}.srt`);
    let subtitlesContent = "";
    let startTime = 0;

    for (let i = 0; i < segment.dialogue.length; i++) {
      const dialogue = segment.dialogue[i];
      const audioFile = audioFiles.find((af) => af.dialogue === dialogue);
      if (!audioFile) {
        throw new Error(`Audio file not found for dialogue: ${dialogue}`);
      }
      const duration = await this.getAudioDuration(audioFile.path);

      const endTime = startTime + duration;
      subtitlesContent += `${i + 1}\n`;
      subtitlesContent += `${this.formatTime(startTime)} --> ${this.formatTime(
        endTime
      )}\n`;
      subtitlesContent += `${dialogue}\n\n`;

      startTime = endTime;
    }

    fs.writeFileSync(subtitlesPath, subtitlesContent);
    console.log(`Subtitles saved successfully: ${subtitlesPath}`);
    return subtitlesPath;
  }

  // Get the duration of an audio file
  async getAudioDuration(audioPath) {
    console.log(`Getting duration for audio file: ${audioPath}`);
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          console.error(`Failed to get duration for ${audioPath}.`, err);
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  // Format time for subtitles
  formatTime(seconds) {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 12).replace(".", ",");
  }

  // Merge multiple audio files into one
  async mergeAudioFiles(audioPaths, outputPath) {
    console.log(`Merging audio files into: ${outputPath}`);
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      audioPaths.forEach((audioPath) => {
        command.input(audioPath);
      });

      command
        .on("start", (commandLine) => {
          console.log("FFmpeg Command:", commandLine);
        })
        .on("error", (err) => {
          console.error("Failed to merge audio files.", err);
          reject(err);
        })
        .on("end", () => {
          console.log(`Audio files merged successfully: ${outputPath}`);
          resolve(outputPath);
        })
        .mergeToFile(outputPath, this.audioDir);
    });
  }

  // Helper method to check if a file has an audio stream using ffprobe
  async hasAudioStream(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, { path: ffprobe.path }, (err, metadata) => {
        if (err) {
          console.error(`Failed to probe ${filePath}:`, err);
          reject(err);
        } else {
          const hasAudio = metadata.streams.some(
            (stream) => stream.codec_type === "audio"
          );
          resolve(hasAudio);
        }
      });
    });
  }

  // Create a video segment using ffmpeg directly
  async createVideoSegment(segment, images, audioFiles, subtitlesPath) {
    console.log(`Creating video segment ${segment.id}...`);
    const segmentDir = path.join(this.segmentsDir, segment.id);
    await fse.ensureDir(segmentDir);

    // Get image paths
    const imagePaths = segment.images.map((image) => {
      const imagePath = images.find((imgPath) =>
        imgPath.includes(image.id?.replace("image", "").replace("_", "").replace("-",""))
      );
      if (!imagePath || !fs.existsSync(imagePath)) {
        throw new Error(`Image not found for ID: ${image.id}`);
      }
      return imagePath;
    });

    // Get audio paths
    const audioPaths = segment.dialogue.map((dialogue) => {
      const audioFile = audioFiles.find((af) => af.dialogue === dialogue);
      if (!audioFile || !fs.existsSync(audioFile.path)) {
        throw new Error(`Audio file not found for dialogue: ${dialogue}`);
      }
      return audioFile.path;
    });

    const outputSegmentPath = path.join(segmentDir, `${segment.id}.mp4`);

    // Merge audio files if there are multiple
    let mergedAudioPath;
    if (audioPaths.length > 1) {
      mergedAudioPath = path.join(
        this.audioDir,
        `merged_audio_${segment.id}.mp3`
      );
      await this.mergeAudioFiles(audioPaths, mergedAudioPath);
    } else {
      mergedAudioPath = audioPaths[0]; // Use the single audio file
    }

    // Verify if the merged audio file has an audio stream
    const hasAudio = await this.hasAudioStream(mergedAudioPath);
    if (!hasAudio) {
      throw new Error(`No audio stream found in ${mergedAudioPath}.`);
    }

    // Get the duration of the merged audio file
    const audioDuration = await this.getAudioDuration(mergedAudioPath);

    // Calculate the duration for each image
    const imageDuration = audioDuration / imagePaths.length;

    // Log inputs for debugging
    console.log("Image Paths:", imagePaths);
    console.log("Merged Audio Path:", mergedAudioPath);
    console.log("Subtitles Path:", subtitlesPath);

    // Create video using ffmpeg directly
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add images as input
      imagePaths.forEach((imagePath, index) => {
        command
          .input(imagePath)
          .inputOptions([`-loop 1`, `-t ${imageDuration}`]);
      });

      // Add merged audio as input
      command.input(mergedAudioPath);

      // Build the filtergraph dynamically
      const filtergraph = [];

      // Step 1: Concatenate images
      filtergraph.push(`concat=n=${imagePaths.length}:v=1:a=0[v]`);

      // Step 2: Add subtitles if available
      if (fs.existsSync(subtitlesPath)) {
        filtergraph.push(
          `[v]subtitles=${subtitlesPath}:force_style='Fontname=Arial,Fontsize=20,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=&H40000000&,Bold=1,BorderStyle=3,Outline=1,Shadow=2,Alignment=2,MarginL=40,MarginR=40,MarginV=10'[v]`
        );
      }

      // Step 3: Combine video and audio
      filtergraph.push(`[v][1:a]concat=n=1:v=1:a=1`);

      // Set output options
      command
        .complexFilter(filtergraph)
        .outputOptions(["-c:v libx264", "-c:a aac"])
        .save(outputSegmentPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg Command:", commandLine);
        })
        .on("end", () => {
          console.log(`Video segment saved successfully: ${outputSegmentPath}`);
          resolve(outputSegmentPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.error(`Failed to create video segment ${segment.id}.`);
          console.error("FFmpeg Error:", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        });
    });
  }

  // Concatenate all video segments into a final video
  async concatenateSegments(segmentPaths) {
    console.log("Concatenating video segments...");
    const finalVideoPath = path.join(
      this.videoDir,
      `${this.sanitizedTitle}.mp4`
    );

    // Use FFmpeg's concat filter instead of the concat protocol
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      segmentPaths.forEach((segmentPath) => {
        command.input(segmentPath);
      });

      command
        .complexFilter([`concat=n=${segmentPaths.length}:v=1:a=1`])
        .outputOptions(["-c:v libx264", "-c:a aac"])
        .save(finalVideoPath)
        .on("start", (command) => {
          console.log("FFmpeg Command:", command);
        })
        .on("end", () => {
          console.log(`Final video saved successfully: ${finalVideoPath}`);
          resolve(finalVideoPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.error("Failed to concatenate video segments.", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        });
    });
  }

  // Add background music to the final video with lower volume
  async addBackgroundMusic(finalVideoPath) {
    console.log("Adding background music...");
    const musicType = this.jsonData.video.music_type;
    const musicDir = path.join(__dirname, "background_audio_clips", musicType);

    // Get a random music clip from the specified directory
    const musicClips = fs.readdirSync(musicDir);
    const randomClip =
      musicClips[Math.floor(Math.random() * musicClips.length)];
    const musicClipPath = path.join(musicDir, randomClip);

    // Get the duration of the final video
    const videoDuration = await this.getVideoDuration(finalVideoPath);

    // Create a temporary music clip with the same duration as the video
    const tempMusicClipPath = path.join(this.audioDir, "temp_music_clip.mp3");
    await this.adjustAudioDuration(
      musicClipPath,
      tempMusicClipPath,
      videoDuration
    );

    // Merge the background music with the final video
    const finalVideoWithMusicPath = path.join(
      this.videoDir,
      `${this.sanitizedTitle}_with_music.mp4`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(finalVideoPath)
        .input(tempMusicClipPath)
        .complexFilter([
          "[1:a]volume=0.3[bgmusic];[0:a][bgmusic]amix=inputs=2:duration=first[a]", // Reduce background music volume to 30% and mix
        ])
        .outputOptions([
          "-c:v copy", // Copy the video stream without re-encoding
          "-map 0:v", // Map the video stream from the first input
          "-map [a]", // Map the mixed audio stream
          "-shortest", // Ensure the output duration is the shortest of the inputs
        ])
        .save(finalVideoWithMusicPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg Command:", commandLine);
        })
        .on("end", () => {
          console.log(
            `Final video with background music saved successfully: ${finalVideoWithMusicPath}`
          );
          resolve(finalVideoWithMusicPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.error("Failed to add background music.", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        });
    });
  }

  // Adjust the duration of an audio file to match the video duration
  async adjustAudioDuration(inputPath, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([`-t ${duration}`])
        .save(outputPath)
        .on("end", () => {
          console.log(
            `Adjusted audio duration saved successfully: ${outputPath}`
          );
          resolve(outputPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.error("Failed to adjust audio duration.", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        });
    });
  }

  // Get the duration of a video file
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error(`Failed to get duration for ${videoPath}.`, err);
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  // Generate the final video
  async generateVideo() {
    try {
      await this.ensureDirectories();
      const images = await this.generateImages();
      const audioFiles = await this.generateAudio();

      const segmentPaths = [];
      const totalSegments = this.jsonData.video.layout.length;

      for (let i = 0; i < totalSegments; i++) {
        const segment = this.jsonData.video.layout[i];
        const subtitlesPath = await this.createSubtitles(segment, audioFiles);
        const segmentPath = await this.createVideoSegment(
          segment,
          images,
          audioFiles,
          subtitlesPath
        );
        segmentPaths.push(segmentPath);
      }

      const finalVideoPath = await this.concatenateSegments(segmentPaths);
      const finalVideoWithMusicPath = await this.addBackgroundMusic(
        finalVideoPath
      );
      console.log(
        `Video generation completed successfully. Final video with background music: ${finalVideoWithMusicPath}`
      );
      return {
        finalVideoPath: finalVideoWithMusicPath,
        outputDir: this.videoDir,
        jsonData: this.jsonData,
      };
    } catch (error) {
      console.error("Video generation failed.", error);
      throw error; // Propagate the error to the caller
    }
  }
}


module.exports = VideoGenerator;

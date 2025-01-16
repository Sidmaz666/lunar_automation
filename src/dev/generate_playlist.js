const youtubedl = require('youtube-dl-exec');
const fs = require('fs-extra');
const path = require('path');

// List of 20 possible music types
const musicTypes = [
    'mystical', 'horror', 'epic', 'calm', 'romantic',
    'sad', 'happy', 'uplifting', 'dark', 'fantasy',
    'adventure', 'medieval', 'cinematic', 'ambient', 'relaxing',
    'energetic', 'action', 'suspense', 'emotional', 'inspirational'
];

// Function to create a directory for a music type
async function createMusicTypeDirectory(musicType) {
    const dirPath = path.join(__dirname, 'music_clips', musicType);
    console.log(`[Directory] Checking if directory exists: ${dirPath}`);
    if (!(await fs.pathExists(dirPath))) {
        console.log(`[Directory] Directory does not exist. Creating: ${dirPath}`);
        await fs.ensureDir(dirPath);
        console.log(`[Directory] Created directory: ${dirPath}`);
    } else {
        console.log(`[Directory] Directory already exists: ${dirPath}`);
    }
    return dirPath;
}

// Function to download and trim an audio clip to 2 minutes
async function downloadAndTrimAudioClip(videoUrl, outputPath) {
    console.log(`[Download] Starting download for: ${videoUrl}`);
    console.log(`[Download] Output path: ${outputPath}`);
    try {
        await youtubedl(videoUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: outputPath,
            noWarnings: true,
            preferFreeFormats: true,
            postprocessorArgs: '-ss 0 -t 120', // Trim to 2 minutes (120 seconds)
        });
        console.log(`[Download] Successfully downloaded and trimmed: ${outputPath}`);
    } catch (error) {
        console.error(`[Download] Error downloading or trimming ${videoUrl}:`, error);
    }
}

// Function to search for instrumental music
async function searchInstrumentalMusic(keyword, limit = 5) {
    console.log(`[Search] Searching for: ${keyword} instrumental`);
    try {
        const searchQuery = `${keyword} instrumental`;
        const results = await youtubedl(`ytsearch${limit * 2}:${searchQuery}`, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
        });

        console.log(`[Search] Found ${results.entries.length} results for: ${keyword}`);
        const filteredResults = (results.entries || []).slice(0, limit); // Limit to 5 videos
        console.log(`[Search] Filtered to ${filteredResults.length} results for: ${keyword}`);

        return filteredResults;
    } catch (error) {
        console.error(`[Search] Error searching for ${keyword}:`, error);
        return [];
    }
}

// Function to create a playlist and download audio clips
async function createPlaylistAndDownload(musicTypes) {
    const playlist = {};

    for (const type of musicTypes) {
        console.log(`[Playlist] Processing music type: ${type}`);

        // Create directory for the music type
        const dirPath = await createMusicTypeDirectory(type);

        // Search for instrumental music
        console.log(`[Playlist] Searching for instrumental music of type: ${type}`);
        const videos = await searchInstrumentalMusic(type);
        playlist[type] = [];

        // Download and trim each audio clip
        console.log(`[Playlist] Downloading and trimming audio clips for: ${type}`);
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            console.log(`[Playlist] Processing video ${i + 1}: ${video.title}`);
            const outputPath = path.join(dirPath, `clip_${i + 1}.mp3`);
            console.log(`[Playlist] Output path for clip ${i + 1}: ${outputPath}`);

            await downloadAndTrimAudioClip(video.webpage_url, outputPath);

            // Add to playlist
            playlist[type].push({
                title: video.title,
                url: video.webpage_url,
                duration: 120, // Clips are trimmed to 2 minutes
                filePath: outputPath,
            });
            console.log(`[Playlist] Added clip ${i + 1} to playlist: ${video.title}`);
        }

        console.log(`[Playlist] Finished processing music type: ${type}`);
    }

    return playlist;
}

// Function to save the playlist as a JSON file
async function savePlaylistToFile(playlist) {
    const playlistFilePath = path.join(__dirname, 'music_clips', 'playlist.json');
    console.log(`[Save] Saving playlist to: ${playlistFilePath}`);
    try {
        await fs.writeJson(playlistFilePath, playlist, { spaces: 2 });
        console.log(`[Save] Successfully saved playlist to: ${playlistFilePath}`);
    } catch (error) {
        console.error(`[Save] Error saving playlist to ${playlistFilePath}:`, error);
    }
}

// Main function
(async () => {
    console.log('[Main] Starting playlist generation and audio clip download...');

    const playlist = await createPlaylistAndDownload(musicTypes);

    console.log('[Main] Generated Playlist:');
    console.log(JSON.stringify(playlist, null, 2));

    // Save the playlist to a JSON file
    await savePlaylistToFile(playlist);

    console.log('[Main] All audio clips downloaded, trimmed, and playlist saved successfully!');
})();

const InstagramService = require("./InstagramService");
const DeepTalk = require("./DeepTalk");
const VideoGenerator = require("./VideoGenerator");
const EmailService = require("./EmailService");
const generateVideoPrompt = require("./PromptService");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const {DEEPTALK_EMAIL, DEEPTALK_PASSWORD} = require("../config")


class VideoService {
  constructor(user, config) {
    if (!user || !user.niche || !user.accountType  || !user.email ) {
      throw new Error(
        'Invalid user: Missing required "niche", "accountType" or "email" property.'
      );
    }

    this.user = user;
    this.instagramService = new InstagramService(user);
    this.emailService = new EmailService();
    this.additionalConfig = config || {};
  }

  async generateVideo() {
    const chatBot = new DeepTalk({
      email: DEEPTALK_EMAIL,
      password: DEEPTALK_PASSWORD,
    });
    try {
      const random_niche =  this.additionalConfig.niche ? 
	this.additionalConfig.niche[Math.floor(Math.random() * this.additionalConfig.niche.length)] : 
        this.user.niche[Math.floor(Math.random() * this.user.niche.length)];
      const content_idea_prompt = `Please Give me 10 to 20 unique creative content ideas for Instagram Reel and YouTube Shorts Video content based on the niche "${random_niche}". The content includes a video with images,subtitle and audio! So, please me considerate about it while generating the ideas, also ensure you do the followings:
- Ensure to Analyze the latest ongoing trends related to the niche, to get relevant ideas.
- Please provide a very context rich long detailed description of each ideas.
- Ensure each content idea is random.

Here are few examples based on the niche "Fashion":
- Your outfit style based on your favorite color palette.
- The iconic fashion trend you’d rock based on your personality type.
- Your celebrity fashion twin based on your wardrobe choices.
- The era of fashion that matches your vibe (90s, 2000s, etc.).
- Your signature accessory based on your birthstone.

Here are few examples based on the niche "Anime":
- Your anime squad based on your favorite genre.
- The anime world you’d survive in based on your survival skills.
- Your anime mentor based on your life goals.
- The anime villain you’d team up with based on your flaws.
- Your anime love interest based on your ideal partner traits.

Here are few examples based on the niche "Manga":
- Your manga art style based on your creativity level.
- The manga genre you’d write based on your life story.
- Your manga protagonist role based on your personality.
- The manga panel that represents your current mood.
- Your manga rival based on your competitive streak.

Here are few examples based on the niche "K-Pop":
- Your K-Pop stage name based on your initials.
- The K-Pop concept you’d debut with (cute, edgy, etc.).
- Your K-Pop bias based on your favorite hobby.
- The K-Pop group you’d join based on your vocal range.
- Your K-Pop fandom name based on your zodiac sign.

Here are few examples based on the niche "Generic":
- Your superpower based on your favorite season.
- The mythical creature you’d be based on your spirit animal.
- Your dream vacation based on your bucket list.
- The historical figure you’d meet based on your values.
- Your alternate universe career based on your hidden talents.

Here are few examples based on the niche "Sports":
- Your sports position based on your leadership style.
- The sport you’d dominate based on your energy level.
- Your sports nickname based on your favorite food.
- The team you’d captain based on your teamwork skills.
- Your championship trophy based on your determination.

Here are few examples based on the niche "Science":
- Your scientific discovery based on your curiosity level.
- The element you’d be based on your personality traits.
- Your lab experiment based on your problem-solving skills.
- The planet you’d explore based on your sense of adventure.
- Your invention based on your daily habits.

Here are few examples based on the niche "Technology":
- Your AI assistant name based on your tech preferences.
- The gadget you’d invent based on your daily struggles.
- Your coding language based on your logical thinking.
- The futuristic tech you’d own based on your imagination.
- Your cyberpunk alter ego based on your online persona.

Here are few examples based on the niche "Geopolitics":
- The country you’d lead based on your diplomatic skills.
- Your global alliance based on your values and beliefs.
- The geopolitical crisis you’d solve based on your problem-solving style.
- Your foreign policy strategy based on your leadership approach.
- The historical empire you’d revive based on your vision for the future.

Here are few examples based on the niche "Market":
- Your investment strategy based on your risk tolerance.
- The stock you’d dominate based on your industry knowledge.
- Your market trend prediction based on your analytical skills.
- The startup idea you’d pitch based on your creativity.
- Your trading style based on your personality type.

Here are few examples based on the niche "Economics":
- Your economic theory based on your worldview.
- The economic system you’d implement based on your values.
- Your inflation-fighting strategy based on your resourcefulness.
- The global economic issue you’d tackle based on your expertise.
- Your wealth distribution model based on your sense of fairness.

Here are few examples based on the niche "Environment":
- Your climate change solution based on your innovative thinking.
- The renewable energy source you’d champion based on your location.
- Your conservation project based on your love for nature.
- The endangered species you’d save based on your passion.
- Your eco-friendly lifestyle hack based on your daily habits.

Here are few examples based on the niche "Health & Fitness":
- Your workout routine based on your energy levels.
- The diet plan you’d follow based on your food preferences.
- Your mental health strategy based on your stress triggers.
- The fitness challenge you’d ace based on your determination.
- Your wellness mantra based on your life goals.

Here are few examples based on the niche "Gaming":
- Your gaming avatar based on your personality traits.
- The game genre you’d dominate based on your skills.
- Your ultimate gaming setup based on your preferences.
- The gaming quest you’d complete based on your problem-solving style.
- Your esports team based on your competitive spirit.

Here are few examples based on the niche "Travel":
- Your dream destination based on your wanderlust level.
- The travel buddy you’d choose based on your compatibility.
- Your travel hack based on your packing style.
- The cultural experience you’d dive into based on your interests.
- Your travel bucket list based on your sense of adventure.

Here are few examples based on the niche "Literature":
- Your writing genre based on your storytelling style.
- The classic novel you’d rewrite based on your modern twist.
- Your fictional character based on your personality.
- The poetry style you’d master based on your emotions.
- Your book title based on your life story.

Here are few examples based on the niche "Music":
- Your music genre based on your mood.
- The instrument you’d play based on your creativity.
- Your concert lineup based on your favorite artists.
- The song lyrics that define your life based on your experiences.
- Your stage performance style based on your energy.

Here are few examples based on the niche "History":
- The historical era you’d thrive in based on your skills.
- Your historical figure alter ego based on your ambitions.
- The ancient civilization you’d explore based on your curiosity.
- Your battle strategy based on your tactical thinking.
- The historical event you’d witness based on your interests.

Here are few examples based on the niche "Psychology":
- Your personality archetype based on your behavior.
- The therapy approach you’d benefit from based on your struggles.
- Your coping mechanism based on your stress triggers.
- The psychological experiment you’d design based on your curiosity.
- Your emotional intelligence level based on your relationships.

Here are few examples based on the niche "Space":
- Your planet to colonize based on your survival skills.
- The spaceship design based on your engineering mindset.
- Your alien encounter scenario based on your imagination.
- The galaxy you’d explore based on your sense of adventure.
- Your astronaut role based on your expertise.

Here are few examples based on the niche "Food":
- Your signature dish based on your cooking skills.
- The cuisine you’d master based on your taste preferences.
- Your food truck concept based on your creativity.
- The dessert you’d invent based on your sweet tooth.
- Your ultimate comfort food based on your mood.

Here are few examples based on the niche "Art":
- Your art style based on your creativity.
- The masterpiece you’d create based on your inspiration.
- Your art medium based on your tactile preferences.
- The gallery exhibition theme based on your vision.
- Your artistic alter ego based on your personality.

Here are few examples based on the niche "Social Media":
- Your viral content idea based on your creativity.
- The platform you’d dominate based on your communication style.
- Your influencer niche based on your passions.
- The hashtag campaign you’d start based on your values.
- Your online persona based on your real-life personality.

Here are few examples based on the niche "Business":
- Your startup idea based on your problem-solving skills.
- The leadership style you’d adopt based on your team dynamics.
- Your marketing strategy based on your target audience.
- The industry you’d disrupt based on your innovative thinking.
- Your entrepreneurial journey based on your risk appetite.


Please keep in mind that mentioned here are just few examples, please come up with your own ideas, you can take certain aspects from them but not copy them diretly!. And everytime I ask you this, please provide me a unique response based on this random seed: ${Math.floor(Math.random() * (1000000000 - 100 + 1)) + 100}.

Youc can always create content with the formula below!
- From the Niche: ${random_niche}, find a sub category of that niche. For example if the niche is Ben 10, than we can consider one of his alien/friends/villan/any other entity or a phenomenon to be the sub category of that niche.
- Now, we can come up with 5 or 4 something(points with  an adjective/feeling. example: intersting, mysterious, etc) about that sub category. For example if the sub category is the Aliens, of the niche Ben 10, I can pick any one of the Alien (Let's say Gray Matter) and say few things on it, or I can say few things on few aliens based on their similarities or differences, So the final result would be "Five intersting facts about Alien X". 

Please follow the formula, however don't copy the fomula example! Analyze and understand it to create better content idea.

Please provide me your response as a list! Please don't provide any other explanations or other texts!`;
      const get_content_ideas = this.additionalConfig?.subPrompt || await chatBot.chat(content_idea_prompt, {
        use_search: true,
      });
      const prompt = generateVideoPrompt({
        niche: random_niche,
	topic: this.additionalConfig?.topic || undefined,
        subPrompt: get_content_ideas.message.content,
      });
      console.log(prompt);
      const chat1 = await chatBot.chat(prompt.trim());
      const data = JSON.parse(
        chat1.message.content.replace("```json", "").replace("```", "")
      );
      console.dir(data, { depth: null });
      const videoGenerator = new VideoGenerator(data);
      const videoData = await videoGenerator.generateVideo();
      return videoData;
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      await chatBot.close(); // Close the browser
    }
  }

  async postVideoToInstagram() {
    const generatedVideos = [];

    for (let i = 0; i < this.user.numberOfPosts; i++) {
      try {
        const {outputDir, finalVideoPath, jsonData} = await this.generateVideo();
	generatedVideos.push({ videoPath: finalVideoPath, outputDir, jsonData });
      } catch (error) {
        console.error("Error in main process:", error);
      }
    }

    // Post generated videos to Instagram and YouTube
    for (const { videoPath, outputDir, jsonData } of generatedVideos) {
        const { caption, hashtags } = jsonData.video
        // Upload to Instagram
      await new Promise(async(resolve,_) => {
	try {
	    await this.instagramService.uploadInstagramReel(
	      videoPath,
	      caption,
	      hashtags
	    );
	    resolve()
	  } catch (error) {
	    resolve()
	  }
	})
        // Zip the folder
        const zipFilePath = await this.zipFolder(outputDir);
        console.log("Folder zipped:", zipFilePath);
        // Delete the outputDir
        fs.rmdirSync(outputDir, { recursive: true });
        console.log("Output folder deleted:", outputDir);
        // Send the email to the user
        await this.emailService.sendEmail(
          this.user.email, // Send to the user's email
          "Daily Lunar Automation ~ Generation Success", // Subject
          "Your video has been generated and posted on Instagram successfully.", // Email body
          [
            {
              filename: path.basename(zipFilePath), // Name of the attachment
              path: zipFilePath, // Path to the zip file
            },
          ]
        );
        console.log("Email sent with attachment:", zipFilePath);
        // Delete the zip
        fs.unlinkSync(zipFilePath);
        console.log("Zip file deleted:", zipFilePath);
	return jsonData;
    }
  }

  async zipFolder(folderPath) {
    const zipFilePath = `${folderPath}.zip`;
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Compression level
    });

    return new Promise((resolve, reject) => {
      output.on("close", () => resolve(zipFilePath));
      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.directory(folderPath, false);
      archive.finalize();
    });
  }
}

module.exports = VideoService;

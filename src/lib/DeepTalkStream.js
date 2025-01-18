const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const EventEmitter = require("events");

// Add the Stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DeepTalk extends EventEmitter {
  constructor({ email, password }) {
    super();
    this.chat_session_history = [];
    this.chat_history = [];
    this.current_completions = [];
    this.completionDone = false;
    this.currentSessionId = null;
    this.userToken = null;
    this.email = email;
    this.password = password;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      userDataDir: path.join(__dirname.split("/src")[0], '.cache', "userData"),
    });
    await (
      await this.browser.defaultBrowserContext()
    ).overridePermissions("https://chat.deepseek.com", [
      "clipboard-sanitized-write",
    ]);
    this.page = await this.browser.newPage();

    // Listen to all responses
    this.page.on("response", async (response) => {
      await this._handleResponse(response);
    });
  }

  async _handleResponse(response) {
    const url = response.url();

    try {
      // Check if the page is ready before evaluating JavaScript
      if (!this.page || !this.page.isClosed()) {
        const token = await this.page.evaluate(() => {
          return JSON.parse(localStorage.getItem("userToken"));
        });
        this.userToken = token;
      }
    } catch (error) {
      this.userToken = null;
    }

    if (url.includes("/chat_session/fetch_page")) {
      try {
        const { data } = await response.json(); // Parse JSON response
        const { chat_sessions } = data.biz_data;
        this.chat_session_history = chat_sessions;
      } catch (error) {
        console.error("Error parsing fetch_page response:", error);
      }
    }

    if (url.includes("/chat/history_messages")) {
      try {
        const data = await response.json(); // Parse JSON response
        this.chat_history.push(data);
      } catch (error) {
        console.warn("Error parsing history_messages response");
      }
    }

    if (url.includes("/chat_session/create")) {
      try {
        const { data } = await response.json(); // Parse JSON response
        this.currentSessionId = data.biz_data.id;
      } catch (error) {
        console.warn("Error parsing create_session response:");
      }
    }

    if (url.includes("/chat/completion")) {
      try {
        // Handle the response as a stream
        const stream = await response.buffer();
        const text = stream.toString();

        // Split the response by newlines to handle multiple chunks
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.trim() === "") continue; // Skip empty lines
          if (line.includes("[DONE]")) {
            this.completionDone = true;
            this.emit("end"); // Emit the end event
            return;
          }

          try {
            const data = JSON.parse(line.replace("data: ", ""));
            this.current_completions.push(data);
            this.emit("data", data); // Emit the data chunk
            console.log("Received chunk:", data); // Log each chunk
          } catch (error) {
            console.warn("Error parsing chunk:", error);
          }
        }
      } catch (error) {
        console.warn("Error handling completion response:", error);
      }
    }
  }

  async startChat(message, use_search = false) {
    if (!this.page) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }

    // Check if already on the chat page
    const already_in_chat_page = await this.page.evaluate(() => {
      return window.location.href === "https://chat.deepseek.com/";
    });

    if (!already_in_chat_page) {
      // Navigate to the sign-in page
      await this.page.goto("https://chat.deepseek.com/sign_in", {
        waitUntil: "networkidle2",
      });
    }

    if (!this.userToken || !this.userToken.value) {
      // Check for email and password
      if (!this.email || !this.password) {
        throw new Error("Email and password are required.");
      }

      await this.page.waitForSelector("input[type=text]");
      await this.page.waitForSelector("input[type=password]");

      // Login in
      await this.page.type("input[type=text]", this.email);
      await this.page.type("input[type=password]", this.password);
      await this.page.click(".ds-checkbox");
      await this.page.click(".ds-button");
      await delay(3000);
    }

    // Test Chatting
    const textAreaSelector = "#chat-input";
    await this.page.waitForSelector(textAreaSelector, { timeout: 200000 });

    await this.page
      .evaluate((text) => navigator.clipboard.writeText(text), message) // Copy text to clipboard
      .then(() => this.page.$$(textAreaSelector)) // Find the textarea element(s)
      .then((elements) => {
        if (elements.length > 0) {
          const element = elements[0];
          element.focus(); // Focus on the textarea
          return element;
        } else {
          throw new Error(
            "Textarea not found with selector: " + textAreaSelector
          );
        }
      })
      .then(() => this.page.keyboard.down("Shift")) // Hold down Shift
      .then(() => this.page.keyboard.press("Insert")) // Press Insert (while Shift is held)
      .then(() => this.page.keyboard.up("Shift")) // Release Shift
      .catch((error) => {
        console.error("Failed to paste text:", error);
      });

    // Enable Search
    if (use_search) {
      await this.page.evaluate(() => {
        Array.from(document.querySelectorAll("div[role=button]"))
          .find((e) => e.textContent.toLowerCase().includes("search"))
          .click();
      });
    }

    await this.page.evaluate(() => {
      const chatButton = document.querySelector("input[type=file] + *");
      chatButton.click();
    });
  }

  getCurrentSessionId() {
    return this.currentSessionId;
  }

  async fetchChatHistory(sessionId) {
    if (!this.page) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }
    // Construct the chat history URL using the sessionId
    const chatHistoryUrl = `https://chat.deepseek.com/a/chat/s/${sessionId}`;
    // Navigate to the chat history URL
    await this.page.goto(chatHistoryUrl, { waitUntil: "networkidle2" });
    // Wait for the chat history to be fetched
    await delay(2000); // Adjust delay as needed
  }

  async deleteChat(sessionId = this.currentSessionId, token = this.userToken) {
    if (!this.page || !sessionId || !token) {
      return null; // Return null if sessionId is not provided
    }

    // Make a POST request to delete the chat session
    const response = await this.page.evaluate(
      async (sessionId, token) => {
        const url = "https://chat.deepseek.com/api/v0/chat_session/delete";
        const payload = {
          chat_session_id: sessionId,
        };

        const result = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.value}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        return result.json(); // Return the response data
      },
      sessionId,
      token
    );

    return response; // Return the response data to the caller
  }

  getChatSessionHistory() {
    return this.chat_session_history;
  }

  getChatHistory() {
    return this.chat_history;
  }

  getCurrentCompletions() {
    return this.current_completions;
  }

  async chat(message, options = { use_search: false }) {
    if (!this.page || !this.browser) {
      await this.initialize(); // Initialize the bot
    }
    this.completionDone = false;
    this.current_completions = [];
    await this.startChat(message, options.use_search);

    // Return a stream that emits data chunks
    return this;
  }

  async close() {
    if (this.browser) {
      await this.deleteChat(this.currentSessionId);
      await this.browser.close();
    }
  }
}

// Example usage
const bot = new DeepTalk({ email: 'your-email', password: 'your-password' });

bot.on('data', (chunk) => {
  console.log('Received chunk:', chunk);
});

bot.on('end', async () => {
  console.log('Stream ended');
});

bot.chat('What is the color of the sky? (Just give me the color in one word!)').then(() => {
  console.log('Chat started');
});

module.exports = DeepTalk;

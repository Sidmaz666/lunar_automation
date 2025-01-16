const axios = require("axios");
const https = require("https");
const fs = require("fs");
const path = require("path");
const randomUseragent = require("random-useragent");
const tunnel = require("tunnel"); // Add this library

class TTSGenerator {
  constructor() {
    this.baseUrl = "https://ttsmp3.com";
    this.headersTemplate = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded",
      priority: "u=1, i",
      "sec-ch-ua": '"Brave";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Linux"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      Referer: "https://ttsmp3.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    this.currentProxy = null; // Proxy IP and port
    this.proxyList = []; // Store the proxy list
  }

  // Fetch proxy list from the API
  async fetchProxyList() {
    try {
      console.log("Fetching proxy list...");
      const response = await axios.get(
        "https://github.com/zloi-user/hideip.me/raw/refs/heads/master/https.txt"
      );
      this.proxyList = response.data
        .split("\n")
        .filter((proxy) => proxy.trim() !== "")
        .map((proxy) => proxy.split(":").slice(0, 3).join(":"));
      console.log("Fetched proxy list. Total proxies:", this.proxyList.length);
    } catch (error) {
      console.error("Failed to fetch proxy list:", error.message);
      throw error;
    }
  }

  // Check if a proxy is working
  async checkProxy(proxy) {
    const [host, port] = proxy.split(":");
    try {
      console.log(`Testing proxy: ${proxy}`);
      const agent = tunnel.httpsOverHttps({
        proxy: {
          host,
          port: parseInt(port),
          rejectUnauthorized: false, // Disable SSL verification
        },
      });

      const response = await axios.get("https://httpbin.org/ip", {
        httpsAgent: agent,
        timeout: 10000,
      });

      console.log(`Proxy ${proxy} is working. Response:`, response.data);
      return response.data.origin === host; // Ensure the origin matches the proxy IP
    } catch (error) {
      console.error(`Proxy ${proxy} failed. Error:`, error.message);
      return false;
    }
  }

  // Find a working proxy from the list
  async findWorkingProxy() {
    if (this.proxyList.length === 0) {
      throw new Error("No proxies available in the list.");
    }

    // Iterate through the proxy list to find a working one
    for (let i = 0; i < this.proxyList.length; i++) {
      const proxy = this.proxyList[i];
      const isWorking = await this.checkProxy(proxy);

      if (isWorking) {
        console.log(`Found working proxy: ${proxy}`);
        return proxy;
      } else {
        // Remove the failed proxy from the list
        this.proxyList.splice(i, 1);
        i--; // Adjust the index after removal
        console.log(`Removed failed proxy: ${proxy}`);
      }
    }

    throw new Error("No working proxy found in the list.");
  }

  // Select a working proxy
  async selectWorkingProxy() {
    if (this.proxyList.length === 0) {
      console.log("Proxy list is empty. Fetching new proxies...");
      await this.fetchProxyList();
    }

    const workingProxy = await this.findWorkingProxy();
    if (workingProxy) {
      this.currentProxy = workingProxy;
      console.log(`Selected working proxy: ${this.currentProxy}`);
    } else {
      throw new Error("No working proxy found");
    }
  }

  // Generate dynamic random headers
  getDynamicHeaders() {
    const userAgent = randomUseragent.getRandom();
    const dynamicHeaders = {
      ...this.headersTemplate,
      "User-Agent": userAgent,
      "X-Request-ID": Math.random().toString(36).substring(2, 15), // Unique request ID
      "X-Forwarded-For": `${this.getRandomIp()}`,
    };
    console.log("Generated dynamic headers:", dynamicHeaders);
    return dynamicHeaders;
  }

  // Generate a random IP address
  getRandomIp() {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(
      "."
    );
  }

  // Make a request using the selected proxy and dynamic headers
  async makeRequest(url, options = {}) {
    if (!this.currentProxy) {
      console.log("No proxy selected. Selecting a working proxy...");
      await this.selectWorkingProxy();
    }

    const [host, port] = this.currentProxy.split(":");
    const agent = tunnel.httpsOverHttps({
      proxy: {
        host,
        port: parseInt(port),
        rejectUnauthorized: false, // Disable SSL verification
      },
    });

    try {
      console.log(`Making request to ${url} using proxy: ${this.currentProxy}`);
      const response = await axios({
        ...options,
        url,
        httpsAgent: agent,
        headers: this.getDynamicHeaders(), // Use dynamic headers
      });
      console.log("Request successful. Response:", response.data);
      return response;
    } catch (error) {
      console.error(
        `Request failed with proxy ${this.currentProxy}. Error:`,
        error.message
      );
      throw error;
    }
  }

  // Generate MP3 with infinite retry until successful
  async generateMP3(text, lang = "Matthew") {
    while (true) {
      try {
        console.log("Attempting to generate MP3...");
        const generateResponse = await this.makeRequest(
          `${this.baseUrl}/makemp3_new.php`,
          {
            method: "post",
            data: `msg=${encodeURIComponent(text)}&lang=${encodeURIComponent(
              lang
            )}&source=ttsmp3`,
          }
        );

        const { Error: error, URL: mp3Url, MP3: mp3File } = generateResponse.data;

        if (error !== 0) {
          throw new Error("Error generating TTS");
        }

        console.log("MP3 generated successfully:", mp3Url);
        return mp3File; // Resolve with the MP3 file
      } catch (error) {
        console.error("Failed to generate MP3:", error.message);

        // Remove the failed proxy from the list
        const failedProxyIndex = this.proxyList.indexOf(this.currentProxy);
        if (failedProxyIndex !== -1) {
          this.proxyList.splice(failedProxyIndex, 1);
          console.log(`Removed failed proxy: ${this.currentProxy}`);
        }
        this.currentProxy = null; // Reset the current proxy

        // If no proxies are left, fetch a new list
        if (this.proxyList.length === 0) {
          console.log("No proxies left. Fetching a new proxy list...");
          await this.fetchProxyList();
        }

        // Select a new working proxy
        await this.selectWorkingProxy();
      }
    }
  }

  // Download the generated MP3 file
  async downloadMP3(mp3File, outputFilePath) {
    try {
      console.log("Attempting to download MP3...");
      const outputDir = path.dirname(outputFilePath);
      if (!fs.existsSync(outputDir)) {
        console.log(`Creating output directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const downloadResponse = await this.makeRequest(
        `${this.baseUrl}/dlmp3.php?mp3=${mp3File}&location=direct`,
        {
          responseType: "stream",
        }
      );

      const writer = fs.createWriteStream(outputFilePath);
      downloadResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log("MP3 downloaded successfully:", outputFilePath);
          resolve(outputFilePath);
        });
        writer.on("error", reject);
      });
    } catch (error) {
      console.error("Error downloading MP3:", error.message);
      throw error;
    }
  }

  // Generate and download TTS
  async generateAndDownloadTTS(text, outputFilePath, lang = "Matthew") {
    try {
      console.log("Starting TTS generation and download...");
      const mp3File = await this.generateMP3(text, lang);
      const downloadedFile = await this.downloadMP3(mp3File, outputFilePath);
      return downloadedFile;
    } catch (error) {
      console.error("Failed to generate and download TTS:", error);
      throw error;
    }
  }
}

module.exports = TTSGenerator;

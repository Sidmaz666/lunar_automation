const nodemailer = require("nodemailer");
const { email, clientId, clientSecret, refreshToken } = require("../config");

class EmailService {
  constructor() {
    // No need for a user parameter anymore
  }

  // Function to send an email with optional attachments
  async sendEmail(to, subject, text, attachments = []) {
    console.log({
      email,
      clientId,
      clientSecret,
      refreshToken,
      to,
      subject,
      text,
      attachments,
    });
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: email, // From config
          clientId, // From config
          clientSecret, // From config
          refreshToken, // From config
        },
      });

      const mailOptions = {
        from: email, // From config
        to, // Recipient email passed as an argument
        subject, // Email subject
        text, // Email body
        attachments, // Optional attachments
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent:", info.response);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}

module.exports = EmailService;

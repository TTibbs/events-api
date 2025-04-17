const sgMail = require("@sendgrid/mail");

// Set the API key from environment variable
console.log(
  "Setting up SendGrid with API key:",
  process.env.SENDGRID_API_KEY ? "API key exists" : "API key is missing"
);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send an event registration confirmation email
 * @param {Object} params Email parameters
 * @param {string} params.to Recipient email address
 * @param {string} params.name Recipient name
 * @param {string} params.eventTitle Title of the event
 * @param {string} params.eventDate Date of the event
 * @param {string} params.eventLocation Location of the event
 * @param {string} params.ticketCode Ticket confirmation code
 * @returns {Promise} Promise resolving to SendGrid response
 */
const sendRegistrationConfirmation = async (params) => {
  console.log(`Preparing to send email to ${params.to}`);
  console.log(
    `Using from address: ${
      process.env.SENDGRID_FROM_EMAIL || "noreply@events-platform.com"
    }`
  );

  try {
    const msg = {
      to: params.to,
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@events-platform.com",
      subject: `Your registration is confirmed: ${params.eventTitle}`,
      text: `Hi ${params.name},\n\nThank you for registering for ${
        params.eventTitle
      }. Your registration has been confirmed.\n\nEvent Details:\nDate: ${
        params.eventDate
      }\nLocation: ${
        params.eventLocation || "Online"
      }\n\nYour ticket code is: ${
        params.ticketCode
      }\n\nPlease keep this email as your confirmation. You can also view your tickets in your account.\n\nRegards,\nEvents Platform Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Registration Confirmed</h2>
          <p>Hi ${params.name},</p>
          <p>Thank you for registering for <strong>${
            params.eventTitle
          }</strong>. Your registration has been confirmed.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Event Details:</h3>
            <p><strong>Date:</strong> ${params.eventDate}</p>
            <p><strong>Location:</strong> ${
              params.eventLocation || "Online"
            }</p>
          </div>
          
          <div style="background-color: #fffacd; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h3>Your Ticket Code:</h3>
            <p style="font-size: 24px; letter-spacing: 2px; font-weight: bold;">${
              params.ticketCode
            }</p>
            <p>Please keep this code handy for the event.</p>
          </div>
          
          <p>Please keep this email as your confirmation. You can also view your tickets in your account.</p>
          
          <p>Regards,<br>Events Platform Team</p>
        </div>
      `,
    };

    console.log("Calling SendGrid API...");
    const response = await sgMail.send(msg);
    console.log("SendGrid API response status:", response[0].statusCode);
    return { success: true, response };
  } catch (error) {
    console.error("Email sending failed:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    return { success: false, error };
  }
};

module.exports = {
  sendRegistrationConfirmation,
};

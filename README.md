# Email Confirmation Setup

This application uses SendGrid to send email confirmations when users register for events. To set up the email confirmation system:

1. Create a SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Create an API key in the SendGrid dashboard
3. Set up the following environment variables:
   ```
   SENDGRID_API_KEY=your_api_key_here
   SENDGRID_FROM_EMAIL=your_verified_sender_email@example.com
   ```

Make sure to verify your sender email in SendGrid before using it.

When a user registers for an event, they will automatically receive a confirmation email with their ticket information.

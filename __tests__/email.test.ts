import { sendRegistrationConfirmation } from "../utils/email";
import sgMail from "@sendgrid/mail";

// Mock SendGrid to avoid sending actual emails during tests
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    {
      statusCode: 202,
      body: {},
      headers: {},
    },
  ]),
}));

describe("Email Utility", () => {
  test("sendRegistrationConfirmation sends email with correct data", async () => {
    // Test data
    const emailParams = {
      to: "test@example.com",
      name: "Test User",
      eventTitle: "Test Event",
      eventDate: "Monday, Jan 1, 2024 at 10:00 AM",
      eventLocation: "Test Location",
      ticketCode: "TEST123",
    };

    // Call the function
    const result = await sendRegistrationConfirmation(emailParams);

    // Verify SendGrid was called with the right parameters
    expect(sgMail.send).toHaveBeenCalledTimes(1);

    // Extract the call argument (email object)
    const emailObject = (sgMail.send as jest.Mock).mock.calls[0][0];

    // Check email properties
    expect(emailObject.to).toBe(emailParams.to);
    expect(emailObject.subject).toContain(emailParams.eventTitle);
    expect(emailObject.text).toContain(emailParams.name);
    expect(emailObject.text).toContain(emailParams.eventTitle);
    expect(emailObject.text).toContain(emailParams.eventDate);
    expect(emailObject.text).toContain(emailParams.eventLocation);
    expect(emailObject.text).toContain(emailParams.ticketCode);

    // Verify HTML content
    expect(emailObject.html).toContain(emailParams.name);
    expect(emailObject.html).toContain(emailParams.eventTitle);
    expect(emailObject.html).toContain(emailParams.eventDate);
    expect(emailObject.html).toContain(emailParams.eventLocation);
    expect(emailObject.html).toContain(emailParams.ticketCode);

    // Check result object
    expect(result.success).toBe(true);
  });

  test("sendRegistrationConfirmation handles errors", async () => {
    // Mock SendGrid to throw an error
    (sgMail.send as jest.Mock).mockRejectedValueOnce(new Error("Test error"));

    // Test data
    const emailParams = {
      to: "test@example.com",
      name: "Test User",
      eventTitle: "Test Event",
      eventDate: "Monday, Jan 1, 2024 at 10:00 AM",
      eventLocation: "Test Location",
      ticketCode: "TEST123",
    };

    // Spy on console.error
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    // Call the function
    const result = await sendRegistrationConfirmation(emailParams);

    // Check that error was logged
    expect(consoleSpy).toHaveBeenCalled();

    // Check result indicates failure
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Restore console.error
    consoleSpy.mockRestore();
  });
});

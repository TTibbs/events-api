interface EmailConfirmationParams {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  eventLocation?: string;
  ticketCode: string;
}

interface EmailResponse {
  success: boolean;
  response?: any;
  error?: any;
}

export function sendRegistrationConfirmation(
  params: EmailConfirmationParams
): Promise<EmailResponse>;

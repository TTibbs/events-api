import { Ticket } from "../../../types";
import crypto from "crypto";

// Generate a unique ticket code using md5 hash
const generateTicketCode = () =>
  crypto.createHash("md5").update(Math.random().toString()).digest("hex");

export const tickets: Ticket[] = [
  {
    event_id: 1,
    user_id: 3,
    registration_id: 1,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(),
    used_at: null,
    status: "valid",
  },
  {
    event_id: 1,
    user_id: 1,
    registration_id: 1,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    used_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    status: "used",
  },
  {
    event_id: 1,
    user_id: 2,
    registration_id: 1,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    used_at: null,
    status: "cancelled",
  },
];

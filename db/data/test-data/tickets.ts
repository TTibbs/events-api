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
  {
    event_id: 4,
    user_id: 2,
    registration_id: 2,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(),
    used_at: null,
    status: "valid",
  },
  {
    event_id: 5,
    user_id: 3,
    registration_id: 3,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(),
    used_at: null,
    status: "valid",
  },
  {
    event_id: 6,
    user_id: 1,
    registration_id: 4,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    used_at: new Date(),
    status: "used",
  },
  {
    event_id: 7,
    user_id: 4,
    registration_id: 5,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(),
    used_at: null,
    status: "cancelled",
  },
  {
    event_id: 8, // Summer Music Festival
    user_id: 1,
    registration_id: 6,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    used_at: null,
    status: "valid",
  },
  {
    event_id: 8, // Summer Music Festival
    user_id: 2,
    registration_id: 7,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    used_at: null,
    status: "valid",
  },
  {
    event_id: 9, // Esports Tournament
    user_id: 3,
    registration_id: 8,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    used_at: null,
    status: "valid",
  },
  {
    event_id: 9, // Esports Tournament
    user_id: 4,
    registration_id: 9,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    used_at: null,
    status: "pending_payment",
  },
  {
    event_id: 11, // Art Exhibition Opening
    user_id: 2,
    registration_id: 10,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    used_at: null,
    status: "valid",
  },
  {
    event_id: 12, // Food & Wine Festival
    user_id: 1,
    registration_id: 11,
    paid: false,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    used_at: null,
    status: "cancelled",
  },
  {
    event_id: 14, // Wellness Retreat Weekend
    user_id: 3,
    registration_id: 12,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    used_at: null,
    status: "valid",
  },
  {
    event_id: 15, // Educational Conference for Teachers
    user_id: 4,
    registration_id: 13,
    paid: true,
    ticket_code: generateTicketCode(),
    issued_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    used_at: null,
    status: "valid",
  },
];

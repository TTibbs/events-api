import db from "../db/connection";
import { Ticket } from "../types";
import { convertIdsInArray, convertIds } from "../utils/converters";
import { createNotFoundError } from "../utils/error-handlers";
import { executeTransaction } from "../utils/db-transaction";

// Common ID fields that need to be converted
const idFields = ["id", "event_id", "user_id", "registration_id"];

// Get all tickets
export const fetchAllTickets = async () => {
  const result = await db.query(`
    SELECT * FROM tickets
    ORDER BY issued_at DESC;
  `);

  return convertIdsInArray(result.rows, idFields);
};

// Get ticket by ID
export const fetchTicketById = async (id: number) => {
  const result = await db.query(
    `
    SELECT * FROM tickets WHERE id = $1;
  `,
    [id]
  );
  if (result.rowCount === 0) {
    throw createNotFoundError("Ticket", id);
  }

  return convertIds(result.rows[0], idFields);
};

// Get tickets by user ID
export const fetchTicketsByUserId = async (userId: number) => {
  const result = await db.query(
    `
    SELECT t.*, e.title as event_title, e.start_time, e.end_time, e.location 
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    WHERE t.user_id = $1
    ORDER BY t.issued_at DESC;
  `,
    [userId]
  );

  return convertIdsInArray(result.rows, idFields);
};

// Get tickets by event ID
export const fetchTicketsByEventId = async (eventId: number) => {
  const result = await db.query(
    `
    SELECT t.*, u.username, u.email
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    WHERE t.event_id = $1
    ORDER BY t.issued_at DESC;
  `,
    [eventId]
  );

  return convertIdsInArray(result.rows, idFields);
};

// Get ticket by ticket code
export const fetchTicketByCode = async (ticketCode: string) => {
  const result = await db.query(
    `
    SELECT t.*, e.title as event_title, e.start_time, e.end_time, e.location, u.username, u.email
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    JOIN users u ON t.user_id = u.id
    WHERE t.ticket_code = $1;
  `,
    [ticketCode]
  );
  if (result.rowCount === 0) {
    throw createNotFoundError("Ticket", `with code ${ticketCode}`);
  }

  return convertIds(result.rows[0], idFields);
};

// Create a new ticket
export const createTicket = async (ticketData: Ticket) => {
  const { event_id, user_id, registration_id, ticket_code, status } =
    ticketData;

  const result = await db.query(
    `
    INSERT INTO tickets
      (event_id, user_id, registration_id, ticket_code, status)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING *;
  `,
    [event_id, user_id, registration_id, ticket_code, status || "valid"]
  );

  return convertIds(result.rows[0], idFields);
};

// Create a ticket within a transaction
export const createTicketInTransaction = async (
  client: any,
  ticketData: Ticket
) => {
  const { event_id, user_id, registration_id, ticket_code, status } =
    ticketData;

  const result = await client.query(
    `
    INSERT INTO tickets
      (event_id, user_id, registration_id, ticket_code, status)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING *;
  `,
    [event_id, user_id, registration_id, ticket_code, status || "valid"]
  );

  return convertIds(result.rows[0], idFields);
};

// Update a ticket's status
export const updateTicketStatus = async (id: number, status: string) => {
  // First check if ticket exists
  await fetchTicketById(id);

  // If marking as used, update the used_at timestamp
  if (status === "used") {
    const result = await db.query(
      `
      UPDATE tickets
      SET status = $1, used_at = NOW()
      WHERE id = $2
      RETURNING *;
      `,
      [status, id]
    );

    return convertIds(result.rows[0], idFields);
  }

  // For other status updates
  const result = await db.query(
    `
    UPDATE tickets
    SET status = $1
    WHERE id = $2
    RETURNING *;
    `,
    [status, id]
  );

  return convertIds(result.rows[0], idFields);
};

// Delete a ticket
export const deleteTicket = async (id: number) => {
  // First check if ticket exists
  await fetchTicketById(id);

  const result = await db.query(
    `
    DELETE FROM tickets
    WHERE id = $1
    RETURNING *;
    `,
    [id]
  );

  return convertIds(result.rows[0], idFields);
};

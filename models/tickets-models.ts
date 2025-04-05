import db from "../db/connection";
import { Ticket } from "../types";

// Get all tickets
export const fetchAllTickets = async () => {
  const result = await db.query(`
    SELECT * FROM tickets
    ORDER BY issued_at DESC;
  `);

  // Convert string IDs to numbers
  const tickets = result.rows.map((ticket) => ({
    ...ticket,
    id: Number(ticket.id),
    event_id: Number(ticket.event_id),
    user_id: Number(ticket.user_id),
    registration_id: Number(ticket.registration_id),
  }));

  return tickets;
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
    return null;
  }

  // Convert string IDs to numbers
  const ticket = {
    ...result.rows[0],
    id: Number(result.rows[0].id),
    event_id: Number(result.rows[0].event_id),
    user_id: Number(result.rows[0].user_id),
    registration_id: Number(result.rows[0].registration_id),
  };

  return ticket;
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

  // Convert string IDs to numbers
  const tickets = result.rows.map((ticket) => ({
    ...ticket,
    id: Number(ticket.id),
    event_id: Number(ticket.event_id),
    user_id: Number(ticket.user_id),
    registration_id: Number(ticket.registration_id),
  }));

  return tickets;
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

  // Convert string IDs to numbers
  const tickets = result.rows.map((ticket) => ({
    ...ticket,
    id: Number(ticket.id),
    event_id: Number(ticket.event_id),
    user_id: Number(ticket.user_id),
    registration_id: Number(ticket.registration_id),
  }));

  return tickets;
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
    return null;
  }

  // Convert string IDs to numbers
  const ticket = {
    ...result.rows[0],
    id: Number(result.rows[0].id),
    event_id: Number(result.rows[0].event_id),
    user_id: Number(result.rows[0].user_id),
    registration_id: Number(result.rows[0].registration_id),
  };

  return ticket;
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

  // Convert string IDs to numbers
  const ticket = {
    ...result.rows[0],
    id: Number(result.rows[0].id),
    event_id: Number(result.rows[0].event_id),
    user_id: Number(result.rows[0].user_id),
    registration_id: Number(result.rows[0].registration_id),
  };

  return ticket;
};

// Update a ticket's status
export const updateTicketStatus = async (id: number, status: string) => {
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

    if (result.rowCount === 0) {
      return null;
    }

    // Convert string IDs to numbers
    const ticket = {
      ...result.rows[0],
      id: Number(result.rows[0].id),
      event_id: Number(result.rows[0].event_id),
      user_id: Number(result.rows[0].user_id),
      registration_id: Number(result.rows[0].registration_id),
    };

    return ticket;
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

  if (result.rowCount === 0) {
    return null;
  }

  // Convert string IDs to numbers
  const ticket = {
    ...result.rows[0],
    id: Number(result.rows[0].id),
    event_id: Number(result.rows[0].event_id),
    user_id: Number(result.rows[0].user_id),
    registration_id: Number(result.rows[0].registration_id),
  };

  return ticket;
};

// Delete a ticket
export const deleteTicket = async (id: number) => {
  const result = await db.query(
    `
    DELETE FROM tickets
    WHERE id = $1
    RETURNING *;
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  // Convert string IDs to numbers
  const ticket = {
    ...result.rows[0],
    id: Number(result.rows[0].id),
    event_id: Number(result.rows[0].event_id),
    user_id: Number(result.rows[0].user_id),
    registration_id: Number(result.rows[0].registration_id),
  };

  return ticket;
};

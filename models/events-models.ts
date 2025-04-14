import db from "../db/connection";
import { Event } from "../types";
import {
  executeTransaction,
  executeWithRowLock,
} from "../utils/db-transaction";
import crypto from "crypto";

// Get all events
export const selectEvents = async (): Promise<Event[]> => {
  const result = await db.query(
    `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    ORDER BY e.start_time ASC
    `
  );

  if (result.rows.length === 0) {
    return [];
  }

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));
};

// Get event by ID
export const selectEventById = async (id: number): Promise<Event> => {
  const result = await db.query(
    `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    WHERE e.id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Event not found",
    });
  }

  const event = result.rows[0];
  return {
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  };
};

// Insert new event
export const insertEvent = async (
  status: string,
  title: string,
  description: string | null,
  location: string | null,
  start_time: Date,
  end_time: Date,
  max_attendees: number | null,
  price: number | null,
  event_type: string | null,
  is_public: boolean,
  team_id: number | null,
  created_by: number | null
): Promise<Event> => {
  const result = await db.query(
    `
    INSERT INTO events
      (status, title, description, location, start_time, end_time, max_attendees, price, event_type, is_public, team_id, created_by)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      status,
      title,
      description,
      location,
      start_time,
      end_time,
      max_attendees,
      price,
      event_type,
      is_public,
      team_id,
      created_by,
    ]
  );

  const event = result.rows[0];
  return {
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  };
};

// Update event by ID
export const updateEventById = async (
  id: number,
  updateData: Partial<Event>
): Promise<Event> => {
  // First check if event exists
  await selectEventById(id);

  // Build the SET clause and parameters dynamically based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const validFields = [
    "status",
    "title",
    "description",
    "location",
    "start_time",
    "end_time",
    "max_attendees",
    "price",
    "event_type",
    "is_public",
    "team_id",
    "created_by",
  ];

  validFields.forEach((field) => {
    if (updateData[field as keyof Partial<Event>] !== undefined) {
      updateFields.push(`${field} = $${paramIndex}`);
      values.push(updateData[field as keyof Partial<Event>]);
      paramIndex++;
    }
  });

  // Add updated_at to always be current timestamp
  updateFields.push(`updated_at = NOW()`);

  // Add id as the last parameter
  values.push(id);

  const result = await db.query(
    `
    UPDATE events
    SET ${updateFields.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
    `,
    values
  );

  const event = result.rows[0];
  return {
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  };
};

// Delete event by ID
export const deleteEventById = async (id: number): Promise<void> => {
  // First check if event exists
  await selectEventById(id);

  await db.query(`DELETE FROM events WHERE id = $1`, [id]);
};

// Get event registrations by event ID
export const selectEventRegistrationsByEventId = async (
  eventId: number
): Promise<any[]> => {
  // First check if event exists
  await selectEventById(eventId);

  const result = await db.query(
    `
    SELECT 
      er.*,
      u.username,
      u.email
    FROM event_registrations er
    JOIN users u ON er.user_id = u.id
    WHERE er.event_id = $1
    ORDER BY er.registration_time DESC
    `,
    [eventId]
  );

  return result.rows.map((registration) => ({
    ...registration,
    id: Number(registration.id),
    event_id: Number(registration.event_id),
    user_id: Number(registration.user_id),
  }));
};

// Get upcoming events
export const selectUpcomingEvents = async (
  limit: number = 10
): Promise<Event[]> => {
  const result = await db.query(
    `
    SELECT 
      e.*,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.status = 'published' AND e.start_time > NOW()
    ORDER BY e.start_time ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));
};

// Get events by team ID
export const selectEventsByTeamId = async (
  teamId: number
): Promise<Event[]> => {
  const result = await db.query(
    `
    SELECT 
      e.*,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.team_id = $1
    ORDER BY e.start_time DESC
    `,
    [teamId]
  );

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: Number(event.team_id),
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));
};

// Check if event is available for registration
export const checkEventAvailability = async (
  eventId: number
): Promise<{ available: boolean; reason?: string }> => {
  const event = await selectEventById(eventId);

  // Check if event is published
  if (event.status !== "published") {
    return {
      available: false,
      reason: `Event is ${event.status}, not published`,
    };
  }

  // Check if event is in the future
  if (new Date(event.start_time) <= new Date()) {
    return {
      available: false,
      reason: "Event has already started",
    };
  }

  // Check if event has max_attendees limit and if it's reached
  if (event.max_attendees) {
    const registrationsResult = await db.query(
      `
      SELECT COUNT(*) as registration_count
      FROM event_registrations
      WHERE event_id = $1 AND status = 'registered'
      `,
      [eventId]
    );

    const registrationCount = parseInt(
      registrationsResult.rows[0].registration_count
    );

    if (registrationCount >= event.max_attendees) {
      return {
        available: false,
        reason: "Event has reached maximum attendee capacity",
      };
    }
  }

  return { available: true };
};

// Common ID fields that need to be converted
const idFields = ["id", "team_id", "created_by", "user_id", "event_id"];

// Helper function to generate a random ticket code
function generateTicketCode(): string {
  return crypto
    .createHash("md5")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex");
}

// Register user for an event
export const registerUserForEvent = async (
  eventId: number,
  userId: number
): Promise<any> => {
  // Use row locking to prevent race conditions with capacity checks
  return executeWithRowLock("events", "id = $1", [eventId], async (client) => {
    // Check if event exists and is available (within transaction)
    const eventAvailabilityQuery = await client.query(
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventAvailabilityQuery.rows.length === 0) {
      return Promise.reject({
        status: 404,
        msg: "Event not found",
      });
    }

    const event = eventAvailabilityQuery.rows[0];

    // Check event status
    if (event.status !== "published") {
      return Promise.reject({
        status: 400,
        msg: "Event is draft, not published",
      });
    }

    // Check event dates
    const now = new Date();
    if (new Date(event.start_time) <= now) {
      return Promise.reject({
        status: 400,
        msg: "Event has already started",
      });
    }

    // Check capacity if max_attendees is set
    if (event.max_attendees) {
      const registrationsResult = await client.query(
        `
          SELECT COUNT(*) as registration_count
          FROM event_registrations
          WHERE event_id = $1 AND status = 'registered'
          `,
        [eventId]
      );

      const registrationCount = parseInt(
        registrationsResult.rows[0].registration_count
      );

      if (registrationCount >= event.max_attendees) {
        return Promise.reject({
          status: 400,
          msg: "Event has reached maximum attendee capacity",
        });
      }
    }

    // Check if user is already registered
    const existingRegistration = await client.query(
      `
        SELECT * FROM event_registrations
        WHERE event_id = $1 AND user_id = $2
        `,
      [eventId, userId]
    );

    if (existingRegistration.rows.length > 0) {
      const registration = existingRegistration.rows[0];

      // If registration exists but was cancelled, we can reactivate it
      if (registration.status === "cancelled") {
        const reactivatedResult = await client.query(
          `
            UPDATE event_registrations
            SET status = 'registered', registration_time = NOW()
            WHERE id = $1
            RETURNING *
            `,
          [registration.id]
        );

        const updatedRegistration = reactivatedResult.rows[0];
        return {
          ...updatedRegistration,
          id: Number(updatedRegistration.id),
          event_id: Number(updatedRegistration.event_id),
          user_id: Number(updatedRegistration.user_id),
          reactivated: true,
        };
      }

      // Otherwise, user is already registered
      return Promise.reject({
        status: 400,
        msg: "User is already registered for this event",
      });
    }

    // Create new registration within transaction
    const result = await client.query(
      `
        INSERT INTO event_registrations
          (event_id, user_id, registration_time, status)
        VALUES
          ($1, $2, NOW(), 'registered')
        RETURNING *
        `,
      [eventId, userId]
    );

    const registration = result.rows[0];

    // Generate a unique ticket code
    const ticketCode = generateTicketCode();

    // Create a ticket for the registration within the same transaction
    await client.query(
      `
        INSERT INTO tickets
          (event_id, user_id, registration_id, ticket_code, status)
        VALUES
          ($1, $2, $3, $4, 'valid')
        `,
      [eventId, userId, registration.id, ticketCode]
    );

    return {
      ...registration,
      id: Number(registration.id),
      event_id: Number(registration.event_id),
      user_id: Number(registration.user_id),
    };
  });
};

// Cancel registration
export const cancelRegistration = async (
  registrationId: number
): Promise<any> => {
  // Use transaction to ensure atomicity when cancelling registration and associated tickets
  return executeTransaction(async (client) => {
    // Check if registration exists
    const registrationResult = await client.query(
      `
      SELECT * FROM event_registrations
      WHERE id = $1
      `,
      [registrationId]
    );

    if (registrationResult.rows.length === 0) {
      return Promise.reject({
        status: 404,
        msg: "Registration not found",
      });
    }

    const registration = registrationResult.rows[0];

    // Check if registration is already cancelled
    if (registration.status === "cancelled") {
      return Promise.reject({
        status: 400,
        msg: "Registration is already cancelled",
      });
    }

    // Update registration status
    const result = await client.query(
      `
      UPDATE event_registrations
      SET status = 'cancelled'
      WHERE id = $1
      RETURNING *
      `,
      [registrationId]
    );

    // Update associated tickets
    await client.query(
      `
      UPDATE tickets
      SET status = 'cancelled'
      WHERE registration_id = $1
      `,
      [registrationId]
    );

    const updatedRegistration = result.rows[0];
    return {
      ...updatedRegistration,
      id: Number(updatedRegistration.id),
      event_id: Number(updatedRegistration.event_id),
      user_id: Number(updatedRegistration.user_id),
    };
  });
};

// Get registration by ID
export const getRegistrationById = async (registrationId: number) => {
  const result = await db.query(
    `
    SELECT * FROM event_registrations
    WHERE id = $1
    `,
    [registrationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const registration = result.rows[0];
  return {
    ...registration,
    id: Number(registration.id),
    event_id: Number(registration.event_id),
    user_id: Number(registration.user_id),
  };
};

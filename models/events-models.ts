import db from "../db/connection";
import { Category, Event } from "../types";
import {
  executeTransaction,
  executeWithRowLock,
} from "../utils/db-transaction";
import crypto from "crypto";

export const selectEvents = async (
  sort_by: string = "start_time",
  order: string = "asc",
  category: string = "",
  limit: number = 10,
  page: number = 1
): Promise<{
  events: Event[];
  total_events: number;
  total_pages: number;
}> => {
  // Validate sorting and ordering parameters
  const validSortBy = ["start_time", "price", "location", "max_attendees"];
  const validOrder = ["asc", "desc"];

  if (sort_by && !validSortBy.includes(sort_by)) {
    return Promise.reject({
      status: 400,
      msg: `Invalid sort_by query: ${sort_by} is not a valid sort parameter`,
    });
  }

  if (order && !validOrder.includes(order)) {
    return Promise.reject({
      status: 400,
      msg: `Invalid order query: ${order} is not a valid order parameter`,
    });
  }

  // Build WHERE clauses for both queries
  const whereConditions = [
    "e.status = 'published'",
    "e.is_past = false",
    "e.start_time > NOW()", // Add condition to filter out events that have already started
  ];
  const queryParams = [];
  let paramCounter = 1;

  if (category) {
    whereConditions.push(`e.category = $${paramCounter}`);
    queryParams.push(category);
    paramCounter++;
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // Base query for fetching events
  let queryString = `
    SELECT 
      e.*,
      t.name AS team_name,
      u.username AS creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm ON e.created_by = tm.id
    LEFT JOIN users u ON tm.user_id = u.id
    ${whereClause}
  `;

  // The count query needs to account for the same filtering and JOIN conditions
  // to ensure it matches the main query's results before pagination
  let countQueryString = `
    SELECT COUNT(DISTINCT e.id) AS total_events 
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm ON e.created_by = tm.id
    LEFT JOIN users u ON tm.user_id = u.id
    ${whereClause}
  `;

  // Add GROUP BY, ORDER BY, LIMIT, and OFFSET to the main query
  queryString += ` GROUP BY e.id, t.name, u.username`;
  queryString += ` ORDER BY ${sort_by} ${order}`;

  // Create separate parameters arrays for main and count queries
  const mainQueryParams = [...queryParams]; // Copy the base parameters

  // Add pagination parameters to the main query
  queryString += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
  mainQueryParams.push(limit.toString());
  mainQueryParams.push(((page - 1) * limit).toString());

  return Promise.all([
    db.query(queryString, mainQueryParams),
    db.query(countQueryString, queryParams), // Use original params without pagination
  ]).then(([eventsResult, countResult]) => {
    // Process and return the results
    return {
      events: eventsResult.rows.map((event) => ({
        ...event,
        id: Number(event.id),
        team_id: event.team_id ? Number(event.team_id) : null,
        created_by: event.created_by ? Number(event.created_by) : null,
        price: event.price ? Number(event.price) : null,
        max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
      })),
      total_events: parseInt(countResult.rows[0].total_events, 10),
      total_pages: Math.ceil(
        parseInt(countResult.rows[0].total_events, 10) / limit
      ),
    };
  });
};

export const selectPastEvents = async (): Promise<{
  events: Event[];
  total_pages: number;
}> => {
  const queryString = `
    SELECT 
      e.*,
      t.name AS team_name,
      u.username AS creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm ON e.created_by = tm.id
    LEFT JOIN users u ON tm.user_id = u.id
    WHERE e.status = 'published' AND e.is_past = true
    GROUP BY e.id, t.name, u.username
    ORDER BY e.start_time DESC
  `;

  const result = await db.query(queryString);
  const events = result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));

  return {
    events,
    total_pages: Math.ceil(events.length / 10), // Using default page size of 10
  };
};

export const selectCategories = async (): Promise<Category[]> => {
  const result = await db.query(`SELECT * FROM categories`);
  return result.rows;
};

export const selectCategoryByName = async (name: string): Promise<Category> => {
  const result = await db.query(`SELECT * FROM categories WHERE name = $1`, [
    name,
  ]);

  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: `Category '${name}' not found`,
    });
  }

  return result.rows[0];
};

export const selectDraftEvents = async (userId: number): Promise<Event[]> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    WHERE e.status = 'draft'
    AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = e.team_id 
      AND team_members.user_id = $1
    )
    ORDER BY e.start_time ASC
  `;

  const result = await db.query(query, [userId]);

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

export const selectEventById = async (
  id: number,
  userId: number
): Promise<Event> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    WHERE e.id = $1
    AND e.is_past = false
    AND (
      e.status = 'published'
      OR (
        e.status = 'draft'
        AND EXISTS (
          SELECT 1 FROM team_members 
          WHERE team_members.team_id = e.team_id 
          AND team_members.user_id = $2
        )
      )
    )
  `;

  const result = await db.query(query, [id, userId]);

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

export const getEventByIdForAdmin = async (id: number): Promise<Event> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    WHERE e.id = $1
  `;

  const result = await db.query(query, [id]);

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

export const selectDraftEventById = async (
  id: number,
  userId: number
): Promise<Event> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name,
      tm.username as creator_username
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
    LEFT JOIN users tm ON tm_link.user_id = tm.id
    WHERE e.id = $1
    AND e.status = 'draft'
    AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = e.team_id 
      AND team_members.user_id = $2
    )
  `;

  const result = await db.query(query, [id, userId]);

  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Draft event not found or you don't have access to it",
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

export const insertEvent = async (
  status: string,
  title: string,
  description: string | null,
  event_img_url: string | null,
  location: string | null,
  start_time: Date,
  end_time: Date,
  max_attendees: number | null,
  price: number | null,
  category: string | null,
  is_public: boolean,
  team_id: number | null,
  created_by: number | null
): Promise<Event> => {
  const result = await db.query(
    `
    INSERT INTO events
      (status, title, description, event_img_url, location, start_time, end_time, max_attendees, price, category, is_public, team_id, created_by)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
    `,
    [
      status,
      title,
      description,
      event_img_url,
      location,
      start_time,
      end_time,
      max_attendees,
      price,
      category,
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

export const updateEventById = async (
  id: number,
  updateData: Partial<Event>
): Promise<Event> => {
  // Don't check if event exists using selectEventById since it's filtered by status
  // The controller should handle event existence and authorization first

  // Build the SET clause and parameters dynamically based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const validFields = [
    "status",
    "title",
    "description",
    "event_img_url",
    "location",
    "start_time",
    "end_time",
    "max_attendees",
    "price",
    "category",
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

export const deleteEventById = async (id: number): Promise<void> => {
  // Don't check if event exists using selectEventById since it's filtered by status
  // The controller should handle event existence and authorization first
  await db.query(`DELETE FROM events WHERE id = $1`, [id]);
};

export const selectEventRegistrationsByEventId = async (
  eventId: number
): Promise<any[]> => {
  // Don't check if event exists using selectEventById since it's filtered by status
  // The controller should handle event existence and authorization first
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

  if (result.rows.length === 0) {
    return [];
  }

  return result.rows.map((registration) => ({
    ...registration,
    id: Number(registration.id),
    event_id: Number(registration.event_id),
    user_id: Number(registration.user_id),
  }));
};

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
    WHERE e.status = 'published' 
    AND e.is_past = false
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

export const selectEventsByTeamId = async (
  teamId: number
): Promise<Event[]> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.team_id = $1
    AND e.status = 'published'
    AND e.is_past = false
    ORDER BY e.start_time DESC
  `;

  const result = await db.query(query, [teamId]);

  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Team not found",
    });
  }

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: Number(event.team_id),
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));
};

export const selectDraftEventsByTeamId = async (
  teamId: number,
  userId: number
): Promise<Event[]> => {
  const query = `
    SELECT 
      e.*,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.team_id = $1
    AND e.status = 'draft'
    AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = e.team_id 
      AND team_members.user_id = $2
    )
    ORDER BY e.start_time DESC
  `;

  const result = await db.query(query, [teamId, userId]);

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: Number(event.team_id),
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  }));
};

export const checkEventAvailability = async (
  eventId: number
): Promise<{ available: boolean; reason?: string }> => {
  // Query the event directly instead of using selectEventById
  // which now filters based on status and user
  const result = await db.query(`SELECT * FROM events WHERE id = $1`, [
    eventId,
  ]);

  if (result.rows.length === 0) {
    return Promise.reject({
      status: 404,
      msg: "Event not found",
    });
  }

  const event = result.rows[0];
  const now = new Date();

  // Check if event is published
  if (event.status !== "published") {
    return {
      available: false,
      reason: `Event is ${event.status}, not published`,
    };
  }

  // Check if event has already finished
  if (new Date(event.end_time) <= now) {
    return {
      available: false,
      reason: "Event has already finished",
    };
  }

  // Check if event has already started
  if (new Date(event.start_time) <= now) {
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

function generateTicketCode(): string {
  return crypto
    .createHash("md5")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex");
}

export const registerUserForEvent = async (
  eventId: number,
  userId: number
): Promise<any> => {
  // Use row locking to prevent race conditions with capacity checks
  return executeWithRowLock("events", "id = $1", [eventId], async (client) => {
    // Check if event exists and is available (within transaction)
    const eventAvailabilityQuery = await client.query(
      `SELECT 
        e.*, 
        TO_CHAR(e.start_time, 'FMDay, FMMM DD, YYYY at FMHH12:MI PM') as formatted_date,
        t.name as team_name
      FROM events e
      LEFT JOIN teams t ON e.team_id = t.id
      WHERE e.id = $1`,
      [eventId]
    );

    if (eventAvailabilityQuery.rows.length === 0) {
      return Promise.reject({
        status: 404,
        msg: "Event not found",
      });
    }

    const event = eventAvailabilityQuery.rows[0];
    const now = new Date();

    // Check event status
    if (event.status !== "published") {
      return Promise.reject({
        status: 400,
        msg: "Event is draft, not published",
      });
    }

    // Check if event has already finished
    if (new Date(event.end_time) <= now) {
      return Promise.reject({
        status: 400,
        msg: "Event has already finished",
      });
    }

    // Check if event has already started
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

    // Get the user information for the email
    const userQuery = await client.query(`SELECT * FROM users WHERE id = $1`, [
      userId,
    ]);

    if (userQuery.rows.length === 0) {
      return Promise.reject({
        status: 404,
        msg: "User not found",
      });
    }

    const user = userQuery.rows[0];

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

        // Get existing ticket for this registration or create new one
        const ticketQuery = await client.query(
          `SELECT * FROM tickets WHERE registration_id = $1`,
          [registration.id]
        );

        let ticketCode = "";

        if (ticketQuery.rows.length > 0) {
          const ticket = ticketQuery.rows[0];
          ticketCode = ticket.ticket_code;

          // Update the ticket if needed
          if (ticket.status !== "valid") {
            await client.query(
              `UPDATE tickets SET status = 'valid' WHERE id = $1`,
              [ticket.id]
            );
          }
        } else {
          // Create new ticket if for some reason one doesn't exist
          ticketCode = generateTicketCode();
          await client.query(
            `
            INSERT INTO tickets
              (event_id, user_id, registration_id, ticket_code, status)
            VALUES
              ($1, $2, $3, $4, 'valid')
            `,
            [eventId, userId, registration.id, ticketCode]
          );
        }

        return {
          ...updatedRegistration,
          id: Number(updatedRegistration.id),
          event_id: Number(updatedRegistration.event_id),
          user_id: Number(updatedRegistration.user_id),
          reactivated: true,
          ticket_info: {
            ticket_code: ticketCode,
            event_title: event.title,
            event_date: event.formatted_date,
            event_location: event.location,
            user_name: user.username,
            user_email: user.email,
          },
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
      ticket_info: {
        ticket_code: ticketCode,
        event_title: event.title,
        event_date: event.formatted_date,
        event_location: event.location,
        user_name: user.username,
        user_email: user.email,
      },
    };
  });
};

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

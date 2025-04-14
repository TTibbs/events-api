import format from "pg-format";
import db from "../connection";
import { SeedData } from "../../types";

const seed = async ({
  users,
  teams,
  events,
  eventRegistrations,
  teamMembers,
  userSessions,
  tickets,
}: SeedData) => {
  try {
    // Drop tables in the correct order with CASCADE to handle dependencies
    await db.query("DROP TABLE IF EXISTS tickets CASCADE");
    await db.query("DROP TABLE IF EXISTS event_registrations CASCADE");
    await db.query("DROP TABLE IF EXISTS events CASCADE");
    await db.query("DROP TABLE IF EXISTS team_members CASCADE");
    await db.query("DROP TABLE IF EXISTS teams CASCADE");
    await db.query("DROP TABLE IF EXISTS user_sessions CASCADE");
    await db.query("DROP TABLE IF EXISTS users CASCADE");

    // Drop functions and types
    await db.query("DROP FUNCTION IF EXISTS update_timestamp CASCADE");
    await db.query("DROP TYPE IF EXISTS event_registration_status CASCADE");
    await db.query("DROP TYPE IF EXISTS team_role CASCADE");
    await db.query("DROP TYPE IF EXISTS event_status CASCADE");
    await db.query("DROP TYPE IF EXISTS ticket_status CASCADE");

    // Create types
    await db.query(`
      CREATE TYPE team_role AS ENUM ('admin', 'event_manager', 'team_member');
    `);
    await db.query(`
      CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled');
    `);
    await db.query(`
      CREATE TYPE event_registration_status AS ENUM ('registered', 'cancelled', 'waitlisted', 'attended');
    `);
    await db.query(`
      CREATE TYPE ticket_status AS ENUM ('valid', 'used', 'cancelled', 'expired', 'pending_payment');
    `);

    // Create tables
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE user_sessions (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        session_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE team_members (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        team_id BIGINT REFERENCES teams (id) ON DELETE CASCADE,
        role team_role NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(team_id, user_id)
      );
    `);

    await db.query(`
      CREATE TABLE events (
        id SERIAL PRIMARY KEY,
        status event_status NOT NULL DEFAULT 'draft',
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        max_attendees INTEGER,
        price DECIMAL(10, 2) CHECK (price IS NULL OR price >= 0),
        event_type TEXT,
        is_public BOOLEAN NOT NULL DEFAULT true,
        team_id BIGINT REFERENCES teams (id) ON DELETE SET NULL,
        created_by BIGINT REFERENCES team_members (id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT check_event_times CHECK (end_time > start_time)
      );
    `);

    await db.query(`
      CREATE TABLE event_registrations (
        id SERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES events (id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        registration_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status event_registration_status NOT NULL,
        UNIQUE(event_id, user_id)
      );
    `);

    await db.query(`
      CREATE TABLE tickets (
        id SERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        registration_id BIGINT REFERENCES event_registrations(id) ON DELETE CASCADE,
        paid BOOLEAN DEFAULT FALSE,
        ticket_code TEXT NOT NULL UNIQUE,
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        used_at TIMESTAMP WITH TIME ZONE,
        status ticket_status NOT NULL DEFAULT 'valid',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX idx_events_start_time ON events (start_time);
    `);
    await db.query(`
      CREATE INDEX idx_event_registrations_user_id ON event_registrations (user_id);
    `);
    await db.query(`
      CREATE INDEX idx_events_created_by ON events (created_by);
    `);
    await db.query(`
      CREATE INDEX idx_events_team_id ON events (team_id);
    `);
    await db.query(`
      CREATE INDEX idx_events_status_start_time ON events (status, start_time);
    `);
    await db.query(`
      CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
    `);
    await db.query(`
      CREATE INDEX idx_team_members_user_id ON team_members (user_id);
    `);
    await db.query(`
      CREATE INDEX idx_team_members_team_id ON team_members (team_id);
    `);
    await db.query(`
      CREATE INDEX idx_team_members_role ON team_members (role);
    `);
    await db.query(`
      CREATE INDEX idx_tickets_event_id ON tickets (event_id);
    `);
    await db.query(`
      CREATE INDEX idx_tickets_user_id ON tickets (user_id);
    `);
    await db.query(`
      CREATE INDEX idx_tickets_registration_id ON tickets (registration_id);
    `);
    await db.query(`
      CREATE INDEX idx_tickets_status ON tickets (status);
    `);
    await db.query(`
      CREATE INDEX idx_tickets_ticket_code ON tickets (ticket_code);
    `);

    // Create update_timestamp function
    await db.query(`
        CREATE FUNCTION update_timestamp ()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // Create triggers for updated_at timestamps
    await db.query(`
        CREATE TRIGGER update_event_timestamp
        BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    `);

    await db.query(`
        CREATE TRIGGER update_team_timestamp
        BEFORE UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    `);

    await db.query(`
        CREATE TRIGGER update_ticket_timestamp
        BEFORE UPDATE ON tickets
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    `);

    // 1. Insert users first as they have no dependencies
    const insertUsersQueryString = format(
      `INSERT INTO users (username, email, password_hash) VALUES %L RETURNING id`,
      users.map((user) => [user.username, user.email, user.password_hash])
    );
    await db.query(insertUsersQueryString);

    // 2. Insert teams second as they have no dependencies beyond being created
    const insertTeamsQueryString = format(
      `INSERT INTO teams (name, description) VALUES %L RETURNING id`,
      teams.map((team) => [team.name, team.description])
    );
    await db.query(insertTeamsQueryString);

    // 3. Insert team members third as they depend on users and teams
    const insertTeamMembersQueryString = format(
      `INSERT INTO team_members (user_id, team_id, role, created_at) VALUES %L RETURNING id`,
      teamMembers.map((teamMember) => [
        teamMember.user_id,
        teamMember.team_id,
        teamMember.role,
        teamMember.created_at,
      ])
    );
    await db.query(insertTeamMembersQueryString);

    // 4. Insert events fourth as they depend on teams and team_members
    const insertEventsQueryString = format(
      `INSERT INTO events (status, title, description, location, start_time, end_time, max_attendees, price, event_type, is_public, team_id, created_by, created_at, updated_at) VALUES %L RETURNING id`,
      events.map((event) => [
        event.status,
        event.title,
        event.description,
        event.location,
        event.start_time,
        event.end_time,
        event.max_attendees,
        event.price,
        event.event_type,
        event.is_public,
        event.team_id,
        event.created_by,
        event.created_at,
        event.updated_at,
      ])
    );
    await db.query(insertEventsQueryString);

    // 5. Insert user sessions (depends on users only)
    const insertUserSessionsQueryString = format(
      `INSERT INTO user_sessions (user_id, session_token, refresh_token, created_at, expires_at) VALUES %L`,
      userSessions.map((userSession) => [
        userSession.user_id,
        userSession.session_token,
        userSession.refresh_token,
        userSession.created_at,
        userSession.expires_at,
      ])
    );
    await db.query(insertUserSessionsQueryString);

    // 6. Insert event registrations last as they depend on both users and events
    if (eventRegistrations.length > 0) {
      const insertEventRegistrationsQueryString = format(
        `INSERT INTO event_registrations (event_id, user_id, registration_time, status) VALUES %L`,
        eventRegistrations.map((eventRegistration) => [
          eventRegistration.event_id,
          eventRegistration.user_id,
          eventRegistration.registration_time,
          eventRegistration.status,
        ])
      );
      await db.query(insertEventRegistrationsQueryString);
    }

    // 7. Create tickets for each event registration if we have test data
    if (tickets && tickets.length > 0) {
      // Insert the ticket
      const insertTicketQueryString = format(
        `INSERT INTO tickets 
          (event_id, user_id, registration_id, paid, ticket_code, issued_at, used_at, status)
        VALUES %L`,
        [
          [
            tickets[0].event_id,
            tickets[0].user_id,
            tickets[0].registration_id,
            tickets[0].paid || false,
            tickets[0].ticket_code,
            tickets[0].issued_at,
            tickets[0].used_at,
            tickets[0].status,
          ],
        ]
      );
      await db.query(insertTicketQueryString);
    } else {
      // Generate tickets for registered event attendees if no test tickets provided
      await db.query(`
        INSERT INTO tickets (event_id, user_id, registration_id, ticket_code)
        SELECT er.event_id, er.user_id, er.id, md5(random()::text)
        FROM event_registrations er
        WHERE er.status = 'registered';
      `);
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
};

export default seed;

import format from "pg-format";
import db from "../connection";
import { SeedData } from "../../types/db";

const seed = async ({
  users,
  teams,
  categories,
  events,
  eventRegistrations,
  teamMembers,
  userSessions,
  tickets,
  stripePayments,
}: SeedData) => {
  try {
    // Drop tables in the correct order with CASCADE to handle dependencies
    await db.query("DROP TABLE IF EXISTS tickets CASCADE");
    await db.query("DROP TABLE IF EXISTS stripe_payments CASCADE");
    await db.query("DROP TABLE IF EXISTS event_registrations CASCADE");
    await db.query("DROP TABLE IF EXISTS events CASCADE");
    await db.query("DROP TABLE IF EXISTS team_members CASCADE");
    await db.query("DROP TABLE IF EXISTS teams CASCADE");
    await db.query("DROP TABLE IF EXISTS categories CASCADE");
    await db.query("DROP TABLE IF EXISTS user_sessions CASCADE");
    await db.query("DROP TABLE IF EXISTS users CASCADE");

    // Drop functions and types
    await db.query("DROP FUNCTION IF EXISTS update_timestamp CASCADE");
    await db.query("DROP TYPE IF EXISTS event_registration_status CASCADE");
    await db.query("DROP TYPE IF EXISTS team_role CASCADE");
    await db.query("DROP TYPE IF EXISTS event_status CASCADE");
    await db.query("DROP TYPE IF EXISTS ticket_status CASCADE");
    await db.query("DROP TYPE IF EXISTS stripe_payment_status CASCADE");

    // Create types
    await db.query(`
      CREATE TYPE team_role AS ENUM ('team_admin', 'event_manager', 'team_member');
    `);
    await db.query(`
      CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'past');
    `);
    await db.query(`
      CREATE TYPE event_registration_status AS ENUM ('registered', 'cancelled', 'waitlisted', 'attended');
    `);
    await db.query(`
      CREATE TYPE ticket_status AS ENUM ('valid', 'used', 'cancelled', 'expired', 'pending_payment');
    `);
    await db.query(`
      CREATE TYPE stripe_payment_status AS ENUM ('pending', 'succeeded', 'failed');
    `);

    // Create tables
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile_image_url TEXT,
        is_site_admin BOOLEAN NOT NULL DEFAULT FALSE,
        stripe_customer_id VARCHAR(255),
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
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
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
        event_img_url TEXT,
        location TEXT,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        max_attendees INTEGER,
        price DECIMAL(10, 2) CHECK (price IS NULL OR price >= 0),
        category VARCHAR NOT NULL REFERENCES categories (name),
        is_public BOOLEAN NOT NULL DEFAULT true,
        is_past BOOLEAN NOT NULL DEFAULT false,
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
      CREATE TABLE stripe_payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        stripe_session_id VARCHAR(255) NOT NULL,
        stripe_payment_intent_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'gbp',
        status stripe_payment_status NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
        payment_id BIGINT REFERENCES stripe_payments(id) ON DELETE SET NULL,
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
    await db.query(`
      CREATE INDEX idx_stripe_payments_user_id ON stripe_payments (user_id);
    `);
    await db.query(`
      CREATE INDEX idx_stripe_payments_event_id ON stripe_payments (event_id);
    `);
    await db.query(`
      CREATE INDEX idx_stripe_payments_status ON stripe_payments (status);
    `);
    await db.query(`
      CREATE INDEX idx_stripe_payments_stripe_session_id ON stripe_payments (stripe_session_id);
    `);
    await db.query(`
      CREATE INDEX idx_stripe_payments_stripe_payment_intent_id ON stripe_payments (stripe_payment_intent_id);
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

    // Create trigger to update is_past based on end_time
    await db.query(`
        CREATE OR REPLACE FUNCTION update_event_past_status()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.is_past := CASE 
                WHEN NEW.end_time < NOW() THEN true
                ELSE false
            END;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await db.query(`
        CREATE TRIGGER update_event_past_status
        BEFORE INSERT OR UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION update_event_past_status();
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
      `INSERT INTO users (username, email, password_hash, profile_image_url, is_site_admin) VALUES %L RETURNING id`,
      users.map((user) => [
        user.username,
        user.email,
        user.password_hash,
        user.profile_image_url,
        user.is_site_admin,
      ])
    );
    await db.query(insertUsersQueryString);

    // 2. Insert categories second as they have no dependencies
    const insertCategoriesQueryString = format(
      `INSERT INTO categories (name) VALUES %L RETURNING id`,
      categories.map((category) => [category.name])
    );
    await db.query(insertCategoriesQueryString);

    // 3. Insert teams third as they have no dependencies beyond being created
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
      `INSERT INTO events (status, title, description, event_img_url, location, start_time, end_time, max_attendees, price, category, is_public, team_id, created_by, created_at, updated_at) VALUES %L RETURNING id`,
      events.map((event) => [
        event.status,
        event.title,
        event.description,
        event.event_img_url,
        event.location,
        event.start_time,
        event.end_time,
        event.max_attendees,
        event.price,
        event.category,
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

    // 7. Insert stripe payments if provided
    if (stripePayments && stripePayments.length > 0) {
      const insertStripePaymentsQueryString = format(
        `INSERT INTO stripe_payments 
         (user_id, event_id, stripe_session_id, stripe_payment_intent_id, amount, currency, status, created_at, updated_at) 
         VALUES %L 
         RETURNING id`,
        stripePayments.map((payment) => [
          payment.user_id,
          payment.event_id,
          payment.stripe_session_id,
          payment.stripe_payment_intent_id,
          payment.amount,
          payment.currency,
          payment.status,
          payment.created_at || new Date(),
          payment.updated_at || new Date(),
        ])
      );
      await db.query(insertStripePaymentsQueryString);
    }

    // 8. Create tickets for each event registration if we have test data
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

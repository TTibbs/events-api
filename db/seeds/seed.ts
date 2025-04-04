import format from "pg-format";
import db from "../connection";
import { SeedData } from "../../types";

const seed = async ({
  userData,
  eventData,
  eventRegistrationData,
  staffMemberData,
  userSessionData,
}: SeedData) => {
  try {
    await db.query("DROP TABLE IF EXISTS events_registrations");
    await db.query("DROP TABLE IF EXISTS events");
    await db.query("DROP TABLE IF EXISTS staff_members");
    await db.query("DROP TABLE IF EXISTS user_sessions");
    await db.query("DROP TABLE IF EXISTS users");

    await db.query(`
      CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled');
    `);
    await db.query(`
      CREATE TYPE staff_role AS ENUM ('admin', 'event_manager');
    `);
    await db.query(`
      CREATE TYPE event_registration_status AS ENUM ('registered', 'cancelled', 'waitlisted', 'attended');
    `);

    await db.query(`
        CREATE TABLE users (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE user_sessions (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        session_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE staff_members (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        role staff_role NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE events (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
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
        created_by BIGINT REFERENCES staff_members (id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT check_event_times CHECK (end_time > start_time)
      );
    `);

    await db.query(`
      CREATE TABLE event_registrations (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        event_id BIGINT REFERENCES events (id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
        registration_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status event_registration_status NOT NULL,
        UNIQUE(event_id, user_id)
      );
    `);

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
      CREATE INDEX idx_events_status_start_time ON events (status, start_time);
    `);
    await db.query(`
      CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
    `);

    await db.query(`
        CREATE FUNCTION update_timestamp ()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await db.query(`
        CREATE TRIGGER update_event_timestamp
        BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    `);

    const insertUsersQueryString = format(
      `INSERT INTO users (username, email, password_hash) VALUES %L`,
      userData.map((user) => [user.username, user.email, user.password_hash])
    );
    await db.query(insertUsersQueryString);

    const insertStaffMembersQueryString = format(
      `INSERT INTO staff_members (user_id, role) VALUES %L`,
      staffMemberData.map((staffMember) => [
        staffMember.user_id,
        staffMember.role,
      ])
    );
    await db.query(insertStaffMembersQueryString);

    const insertUserSessionsQueryString = format(
      `INSERT INTO user_sessions (user_id, session_token, refresh_token, created_at, expires_at) VALUES %L`,
      userSessionData.map((userSession) => [
        userSession.user_id,
        userSession.session_token,
        userSession.refresh_token,
        userSession.created_at,
        userSession.expires_at,
      ])
    );
    await db.query(insertUserSessionsQueryString);

    const insertEventRegistrationsQueryString = format(
      `INSERT INTO event_registrations (event_id, user_id, registration_time, status) VALUES %L`,
      eventRegistrationData.map((eventRegistration) => [
        eventRegistration.event_id,
        eventRegistration.user_id,
        eventRegistration.registration_time,
        eventRegistration.status,
      ])
    );
    await db.query(insertEventRegistrationsQueryString);

    const insertEventsQueryString = format(
      `INSERT INTO events (status, title, description, location, start_time, end_time, max_attendees, price, event_type, is_public, created_by, created_at, updated_at) VALUES %L`,
      eventData.map((event) => [
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
        event.created_by,
        event.created_at,
        event.updated_at,
      ])
    );
    await db.query(insertEventsQueryString);
  } catch (err) {
    console.error("Error seeding database:", err);
  }
};

export default seed;

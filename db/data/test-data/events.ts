import { Event } from "../../../types";

export const events: Event[] = [
  {
    status: "published",
    title: "Tech Conference 2025",
    description: "A conference for tech enthusiasts.",
    location: "New York",
    start_time: new Date("2025-06-01T10:00:00Z"),
    end_time: new Date("2025-06-01T18:00:00Z"),
    max_attendees: 200,
    price: 49.99,
    event_type: "conference",
    is_public: true,
    created_by: 1, // Reference to a staff member
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    status: "draft",
    title: "JavaScript Workshop",
    description: "An intensive workshop on modern JavaScript.",
    location: "San Francisco",
    start_time: new Date("2025-07-15T09:00:00Z"),
    end_time: new Date("2025-07-15T17:00:00Z"),
    max_attendees: 50,
    price: 29.99,
    event_type: "workshop",
    is_public: false,
    created_by: 2,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

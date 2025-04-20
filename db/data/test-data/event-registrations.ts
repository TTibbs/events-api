import { EventRegistration } from "../../../types";

export const eventRegistrations: EventRegistration[] = [
  {
    event_id: 1,
    user_id: 3,
    registration_time: new Date(),
    status: "registered",
  },
  {
    event_id: 4,
    user_id: 2,
    registration_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 5,
    user_id: 3,
    registration_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 6,
    user_id: 1,
    registration_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "attended",
  },
  {
    event_id: 7,
    user_id: 4,
    registration_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "cancelled",
  },
  {
    event_id: 8,
    user_id: 1,
    registration_time: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 8,
    user_id: 2,
    registration_time: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 9,
    user_id: 3,
    registration_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 9,
    user_id: 4,
    registration_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 11,
    user_id: 2,
    registration_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 12,
    user_id: 1,
    registration_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "cancelled",
  },
  {
    event_id: 14,
    user_id: 3,
    registration_time: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 14,
    user_id: 4,
    registration_time: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
  {
    event_id: 15,
    user_id: 4,
    registration_time: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: "registered",
  },
];

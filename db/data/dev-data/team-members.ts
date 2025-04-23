import { TeamMember } from "../../../types";

export const teamMembers: TeamMember[] = [
  {
    user_id: 1,
    team_id: 1,
    role: "team_admin",
    created_at: new Date(),
  },
  {
    user_id: 2,
    team_id: 3,
    role: "event_manager",
    created_at: new Date(),
  },
  {
    user_id: 3,
    team_id: 2,
    role: "team_admin",
    created_at: new Date(),
  },
  {
    user_id: 4,
    team_id: 3,
    role: "team_admin",
    created_at: new Date(),
  },
];

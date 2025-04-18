export type Team = {
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
};

export type TeamMember = {
  user_id: number;
  team_id: number;
  role: string;
  created_at: Date;
};

// Extended TeamMember to include ID which is returned from our team model
export interface ExtendedTeamMember extends TeamMember {
  id: number;
}

export type TeamInfo = {
  team_id: number;
  team_name: string;
  team_description: string;
  role: string;
};

export interface TeamResponse extends Team {
  id: number;
}

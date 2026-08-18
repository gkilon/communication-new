
export interface QuestionPair {
  id: string;
  pair: [string, string];
  descriptions: [string, string]; // New field for short definitions
  columns: [keyof Scores, keyof Scores];
}

export interface Scores {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface Profile {
  name: string;
  color: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
}

export interface BackgroundData {
  gender: 'male' | 'female' | 'other' | '';
  isManager: 'yes' | 'no' | '';
  goal: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  team: string; // This will now refer to the Team Name
  teamId?: string;
  orgId: string; // Tenant boundary — every user belongs to exactly one org
  role: 'user' | 'admin'; // 'admin' scopes to their own orgId only, never global
  completedAt?: string; // ISO Date string
  scores?: Scores;
  backgroundData?: BackgroundData;
}

export interface Team {
  id: string;
  name: string;
  orgId: string; // Tenant boundary
  createdAt: string;
  memberCount: number;
}

export interface Organization {
  id: string;
  name: string;
  ownerUid: string;
  plan: 'trial' | 'starter' | 'team' | 'enterprise';
  seatLimit: number;
  monthlyAiCallLimit: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
  createdAt: string;
}

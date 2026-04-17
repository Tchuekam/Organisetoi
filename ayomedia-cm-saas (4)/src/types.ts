export type Role = 'admin' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  companyId: string;
  companyName?: string;
  displayName?: string;
  createdAt: string;
}

export interface Prospect {
  id: string;
  name: string;
  source: 'WhatsApp' | 'Facebook' | 'Marketplace' | 'Ads' | 'Inbox';
  status: 'new' | 'contacted' | 'interested' | 'closed' | 'cold';
  tag?: string;
  companyId: string;
  userId: string;
  lastContactedAt?: string;
  createdAt: string;
  notes?: string;
  aiScore?: number;
  aiRecommendation?: string;
}

export interface Task {
  id: string;
  title: string;
  tag: string;
  status: 'pending' | 'done';
  companyId: string;
  userId: string;
  dueDate?: string;
}

export interface ContentPiece {
  id: string;
  title: string;
  type: 'reel' | 'image' | 'story' | 'video';
  category: 'Informative' | 'Entertainment' | 'Promotional';
  status: 'Idea' | 'Draft' | 'Scheduled' | 'Published';
  companyId: string;
  userId: string;
  platform?: string; // Legacy field, keeping for compatibility
  description?: string;
  script?: string;
  caption?: string;
  mediaUrl?: string;
  createdAt: string;
}

export interface CalendarPost {
  id: string;
  contentId: string;
  scheduledDate: string;
  platforms: ('IG' | 'TikTok' | 'FB')[];
  companyId: string;
  userId: string;
}

export interface Message {
  id: string;
  prospectId: string;
  text: string;
  sender: 'cm' | 'client';
  timestamp: string;
  companyId: string;
}

export interface ResearchItem {
  id: string;
  title: string;
  platform: string;
  url?: string;
  notes?: string;
  category: 'competitor' | 'trend' | 'platform' | 'idea';
  createdAt: string;
  companyId: string;
  userId: string;
}

export interface AnalyticsSummary {
  totalProspects: number;
  newProspectsThisMonth: number;
  prospectsByStatus: Record<string, number>;
  leadsPerSource: Record<string, number>;
  conversionRate: number;
  responseRate: number;
  publishedContentThisMonth: number;
  contentByType: Record<string, number>;
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
  prospectsTrend: { date: string, count: number }[];
}

export interface Invoice {
  id: string;
  clientName: string;
  service: 'Starter' | 'Growth' | 'Premium' | 'Custom';
  amount: number;
  currency: 'FCFA' | 'EUR' | 'USD';
  date: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  notes?: string;
  companyId: string;
  userId: string;
  createdAt: string;
}

export interface Template {
  id: string;
  title: string;
  content: string;
  type: string;
  companyId: string;
  userId: string;
}

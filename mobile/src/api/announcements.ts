import { apiGet } from './client';

export type AudienceRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** The server scopes this to the caller's own audience group — a
 * STUDENT/TEACHER gets only announcements addressed to them. */
export function listAnnouncements(): Promise<Announcement[]> {
  return apiGet<Announcement[]>('/announcements');
}

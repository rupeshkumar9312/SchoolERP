import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type AudienceRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const AUDIENCE_LABELS: Record<AudienceRole, string> = {
  STUDENT: 'Students',
  TEACHER: 'Teachers',
  ADMIN: 'Admins',
};

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  audiences: AudienceRole[];
}

export interface UpdateAnnouncementPayload {
  title?: string;
  body?: string;
  audiences?: AudienceRole[];
}

/** Admin-tier roles get every announcement; a TEACHER/STUDENT gets only the
 * ones addressed to their own audience group — the server does the scoping. */
export function listAnnouncements(): Promise<Announcement[]> {
  return apiGet<Announcement[]>('/announcements');
}

export function getAnnouncement(id: number): Promise<Announcement> {
  return apiGet<Announcement>(`/announcements/${id}`);
}

export function createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
  return apiPost<Announcement>('/announcements', payload);
}

export function updateAnnouncement(
  id: number,
  payload: UpdateAnnouncementPayload,
): Promise<Announcement> {
  return apiPatch<Announcement>(`/announcements/${id}`, payload);
}

export function deleteAnnouncement(id: number): Promise<void> {
  return apiDelete<void>(`/announcements/${id}`);
}

import { apiDelete, apiGet, apiPatch, apiPost } from './client';

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

/** The server scopes this to the caller's own audience group — a
 * STUDENT/TEACHER gets only announcements addressed to them. */
export function listAnnouncements(): Promise<Announcement[]> {
  return apiGet<Announcement[]>('/announcements');
}

export function createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
  return apiPost<Announcement>('/announcements', payload);
}

export function updateAnnouncement(id: number, payload: UpdateAnnouncementPayload): Promise<Announcement> {
  return apiPatch<Announcement>(`/announcements/${id}`, payload);
}

export function deleteAnnouncement(id: number): Promise<void> {
  return apiDelete<void>(`/announcements/${id}`);
}

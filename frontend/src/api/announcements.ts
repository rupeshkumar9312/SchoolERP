import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { appendPageParams, type PageParams, type Paginated } from './pagination';

export type AudienceRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const AUDIENCE_LABELS: Record<AudienceRole, string> = {
  STUDENT: 'Students',
  TEACHER: 'Teachers',
  ADMIN: 'Admins',
};

export interface Announcement {
  id: number;
  title: string;
  /** Null for an image-only announcement (mobile app allows posting with
   * just an image, no body). */
  body: string | null;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  /** Null when no image was attached. A direct, public URL. */
  imageUrl: string | null;
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
export function listAnnouncements(params: PageParams = {}): Promise<Paginated<Announcement>> {
  const search = new URLSearchParams();
  appendPageParams(search, params);
  const query = search.toString();
  return apiGet<Paginated<Announcement>>(`/announcements${query ? `?${query}` : ''}`);
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

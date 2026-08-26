import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, PickedFile } from './client';
import { appendPageParams, PageParams, Paginated } from './pagination';

export type AudienceRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface Announcement {
  id: number;
  title: string;
  /** Null for an image-only announcement — a viewer needs at least one of
   * body or image, but not both. */
  body: string | null;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  /** Null when no image was attached. A direct, public URL — render it
   * straight in an <Image>, no download step. */
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  body?: string;
  audiences: AudienceRole[];
}

export interface UpdateAnnouncementPayload {
  title?: string;
  body?: string;
  audiences?: AudienceRole[];
}

/** The server scopes this to the caller's own audience group — a
 * STUDENT/TEACHER gets only announcements addressed to them. */
export function listAnnouncements(params: PageParams = {}): Promise<Paginated<Announcement>> {
  const search = new URLSearchParams();
  appendPageParams(search, params);
  const query = search.toString();
  return apiGet<Paginated<Announcement>>(`/announcements${query ? `?${query}` : ''}`);
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

export function uploadAnnouncementImage(id: number, file: PickedFile): Promise<Announcement> {
  return apiUpload<Announcement>(`/announcements/${id}/image`, 'file', file);
}

export function removeAnnouncementImage(id: number): Promise<Announcement> {
  return apiDelete<Announcement>(`/announcements/${id}/image`);
}

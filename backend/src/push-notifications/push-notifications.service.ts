import { Injectable, Logger } from '@nestjs/common';
import { AudienceRole, Prisma } from '@prisma/client';
import { STUDENT_ROLE, TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Talks to Expo's push API directly over plain HTTPS rather than via the
 * `expo-server-sdk` package — that package ships ESM-only, which breaks a
 * CommonJS-compiled Nest app at boot (crashes every route, not just push
 * ones) the moment anything imports it. The wire protocol itself is simple
 * enough that the SDK isn't worth that risk. */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  registerToken(userId: number, token: string): Promise<void> {
    return this.prisma.pushToken
      .upsert({ where: { token }, update: { userId }, create: { token, userId } })
      .then(() => undefined);
  }

  /** Only removes the token if it belongs to the caller — a device can't
   * unregister someone else's token. */
  unregisterToken(userId: number, token: string): Promise<void> {
    return this.prisma.pushToken.deleteMany({ where: { token, userId } }).then(() => undefined);
  }

  /** Sends one push notification to every user whose role falls in any of
   * the given audience groups — the same STUDENT/TEACHER/"everyone else is
   * ADMIN" grouping AnnouncementsService uses to decide who can *see* an
   * announcement, so a recipient list here always matches visibility there. */
  async notifyAudiences(audiences: AudienceRole[], payload: PushNotificationPayload): Promise<void> {
    const roleConditions: Prisma.UserWhereInput[] = audiences.map((audience) => {
      if (audience === AudienceRole.STUDENT) return { role: { name: STUDENT_ROLE } };
      if (audience === AudienceRole.TEACHER) return { role: { name: TEACHER_ROLE } };
      return { role: { name: { notIn: [STUDENT_ROLE, TEACHER_ROLE] } } };
    });

    const recipients = await this.prisma.user.findMany({
      where: { OR: roleConditions },
      select: { pushTokens: { select: { token: true } } },
    });
    const tokens = recipients.flatMap((u) => u.pushTokens.map((t) => t.token));

    await this.sendToTokens(tokens, payload);
  }

  /** Narrower than notifyAudiences: only the students of one specific
   * class+section (e.g. new homework), not every student in the school. Only
   * students with their own portal login (userId set) have push tokens at all. */
  async notifyClassSectionStudents(
    classId: number,
    sectionId: number,
    payload: PushNotificationPayload,
  ): Promise<void> {
    const students = await this.prisma.student.findMany({
      where: { classId, sectionId, isActive: true, userId: { not: null } },
      select: { user: { select: { pushTokens: { select: { token: true } } } } },
    });
    const tokens = students.flatMap((s) => s.user?.pushTokens.map((t) => t.token) ?? []);

    await this.sendToTokens(tokens, payload);
  }

  private async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<void> {
    const validTokens = [...new Set(tokens)].filter(isExpoPushToken);
    if (validTokens.length === 0) return;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
    }));

    for (const batch of chunk(messages, EXPO_PUSH_CHUNK_SIZE)) {
      try {
        const res = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          this.logger.error(`Expo push API responded with ${res.status}: ${await res.text()}`);
          continue;
        }

        // Expo returns 200 even when individual messages failed (bad
        // credentials, unregistered device, etc.) — the failure only shows
        // up per-entry in the body, which a bare `res.ok` check silently
        // swallows. Surface it, keyed by which token it was for.
        const body = (await res.json()) as { data?: ExpoPushTicket[] };
        body.data?.forEach((ticket, i) => {
          if (ticket.status === 'error') {
            this.logger.error(
              `Push to ${batch[i].to} failed: ${ticket.message ?? 'unknown error'} (${ticket.details?.error ?? 'no error code'})`,
            );
          }
        });
      } catch (error) {
        this.logger.error('Failed to send a push notification batch', error instanceof Error ? error.stack : error);
      }
    }
  }
}

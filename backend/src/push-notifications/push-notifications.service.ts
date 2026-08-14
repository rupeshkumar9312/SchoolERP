import { Injectable, Logger } from '@nestjs/common';
import { AudienceRole, Prisma } from '@prisma/client';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { STUDENT_ROLE, TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expo = new Expo();

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

  private async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<void> {
    const validTokens = [...new Set(tokens)].filter((token) => Expo.isExpoPushToken(token));
    if (validTokens.length === 0) return;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
    }));

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error('Failed to send a push notification chunk', error instanceof Error ? error.stack : error);
      }
    }
  }
}

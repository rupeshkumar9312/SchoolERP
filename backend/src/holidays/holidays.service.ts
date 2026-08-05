import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto, ListHolidaysQueryDto } from './dto/holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListHolidaysQueryDto) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateHolidayDto) {
    try {
      return await this.prisma.holiday.create({
        data: { date: new Date(dto.date), name: dto.name },
      });
    } catch (error) {
      throw this.mapError(error, 'A holiday is already set for this date');
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.holiday.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error, 'Cannot delete this holiday');
    }
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return new ConflictException(conflictMessage);
      if (error.code === 'P2025') return new NotFoundException('Holiday not found');
    }
    return error as Error;
  }
}

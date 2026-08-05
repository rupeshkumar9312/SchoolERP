import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from './dto/class.dto';
import { CreateSectionDto, ListSectionsQueryDto, UpdateSectionDto } from './dto/section.dto';
import { CreateSubjectDto, ListSubjectsQueryDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Academic years ----------------------------------------------------

  findAllAcademicYears() {
    return this.prisma.academicYear.findMany({ orderBy: { name: 'desc' } });
  }

  async createAcademicYear(dto: CreateAcademicYearDto) {
    try {
      if (dto.isCurrent) {
        return await this.prisma.$transaction(async (tx) => {
          await tx.academicYear.updateMany({
            where: { isCurrent: true },
            data: { isCurrent: false },
          });
          return tx.academicYear.create({ data: { name: dto.name, isCurrent: true } });
        });
      }
      return await this.prisma.academicYear.create({ data: { name: dto.name, isCurrent: false } });
    } catch (error) {
      throw this.mapError(error, 'An academic year with this name already exists');
    }
  }

  async updateAcademicYear(id: number, dto: UpdateAcademicYearDto) {
    try {
      if (dto.isCurrent) {
        return await this.prisma.$transaction(async (tx) => {
          await tx.academicYear.updateMany({
            where: { isCurrent: true, id: { not: id } },
            data: { isCurrent: false },
          });
          return tx.academicYear.update({ where: { id }, data: dto });
        });
      }
      return await this.prisma.academicYear.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.mapError(error, 'An academic year with this name already exists');
    }
  }

  async removeAcademicYear(id: number) {
    try {
      await this.prisma.academicYear.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error, 'Cannot delete an academic year that still has classes');
    }
  }

  // ---- Classes -------------------------------------------------------------

  findAllClasses(query: ListClassesQueryDto) {
    return this.prisma.class.findMany({
      where: { academicYearId: query.academicYearId },
      orderBy: { name: 'asc' },
    });
  }

  async createClass(dto: CreateClassDto) {
    await this.assertAcademicYearExists(dto.academicYearId);
    try {
      return await this.prisma.class.create({ data: dto });
    } catch (error) {
      throw this.mapError(error, 'This class already exists for that academic year');
    }
  }

  async updateClass(id: number, dto: UpdateClassDto) {
    try {
      return await this.prisma.class.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.mapError(error, 'This class already exists for that academic year');
    }
  }

  async removeClass(id: number) {
    try {
      await this.prisma.class.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error, 'Cannot delete a class that still has sections or subjects');
    }
  }

  // ---- Sections --------------------------------------------------------------

  findAllSections(query: ListSectionsQueryDto) {
    return this.prisma.section.findMany({
      where: { classId: query.classId },
      orderBy: { name: 'asc' },
    });
  }

  async createSection(dto: CreateSectionDto) {
    await this.assertClassExists(dto.classId);
    try {
      return await this.prisma.section.create({ data: dto });
    } catch (error) {
      throw this.mapError(error, 'This section already exists for that class');
    }
  }

  async updateSection(id: number, dto: UpdateSectionDto) {
    try {
      return await this.prisma.section.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.mapError(error, 'This section already exists for that class');
    }
  }

  async removeSection(id: number) {
    try {
      await this.prisma.section.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error, 'Cannot delete this section');
    }
  }

  // ---- Subjects ----------------------------------------------------------

  findAllSubjects(query: ListSubjectsQueryDto) {
    return this.prisma.subject.findMany({
      where: { classId: query.classId },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    await this.assertClassExists(dto.classId);
    try {
      return await this.prisma.subject.create({ data: dto });
    } catch (error) {
      throw this.mapError(error, 'This subject already exists for that class');
    }
  }

  async updateSubject(id: number, dto: UpdateSubjectDto) {
    try {
      return await this.prisma.subject.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.mapError(error, 'This subject already exists for that class');
    }
  }

  async removeSubject(id: number) {
    try {
      await this.prisma.subject.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error, 'Cannot delete this subject');
    }
  }

  // ---- Shared helpers ------------------------------------------------------

  private async assertAcademicYearExists(id: number): Promise<void> {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException('Unknown academicYearId');
  }

  private async assertClassExists(id: number): Promise<void> {
    const klass = await this.prisma.class.findUnique({ where: { id } });
    if (!klass) throw new NotFoundException('Unknown classId');
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2003')
        return new ConflictException(conflictMessage);
      if (error.code === 'P2025') return new NotFoundException('Not found');
    }
    return error as Error;
  }
}

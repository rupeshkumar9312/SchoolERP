import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicService } from './academic.service';
import { ClassesController } from './classes.controller';
import { SectionsController } from './sections.controller';
import { SubjectsController } from './subjects.controller';

@Module({
  imports: [AuthModule],
  controllers: [AcademicYearsController, ClassesController, SectionsController, SubjectsController],
  providers: [AcademicService],
})
export class AcademicModule {}

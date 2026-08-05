import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentsBulkImportService } from './students-bulk-import.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentsBulkImportService],
})
export class StudentsModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsBulkImportService } from './assignments-bulk-import.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentsBulkImportService],
})
export class AssignmentsModule {}

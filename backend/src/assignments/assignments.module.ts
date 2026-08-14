import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { AssignmentsBulkImportService } from './assignments-bulk-import.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [AuthModule, AuditModule, PushNotificationsModule, CloudinaryModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentsBulkImportService],
})
export class AssignmentsModule {}

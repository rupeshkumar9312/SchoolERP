import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';

@Module({
  imports: [AuthModule],
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class HolidaysModule {}

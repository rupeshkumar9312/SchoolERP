import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateHolidayDto, ListHolidaysQueryDto } from './dto/holiday.dto';
import { HolidaysService } from './holidays.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @RequirePermission('academic.view')
  findAll(@Query() query: ListHolidaysQueryDto) {
    return this.holidays.findAll(query);
  }

  @Post()
  @RequirePermission('academic.manage')
  create(@Body() dto: CreateHolidayDto) {
    return this.holidays.create(dto);
  }

  @Delete(':id')
  @RequirePermission('academic.manage')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.holidays.remove(id);
  }
}

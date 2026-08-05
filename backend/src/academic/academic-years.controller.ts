import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academic: AcademicService) {}

  @Get()
  @RequirePermission('academic.view')
  findAll() {
    return this.academic.findAllAcademicYears();
  }

  @Post()
  @RequirePermission('academic.manage')
  create(@Body() dto: CreateAcademicYearDto) {
    return this.academic.createAcademicYear(dto);
  }

  @Patch(':id')
  @RequirePermission('academic.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAcademicYearDto) {
    return this.academic.updateAcademicYear(id, dto);
  }

  @Delete(':id')
  @RequirePermission('academic.manage')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.academic.removeAcademicYear(id);
  }
}

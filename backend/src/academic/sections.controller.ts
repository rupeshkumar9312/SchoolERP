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
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AcademicService } from './academic.service';
import { CreateSectionDto, ListSectionsQueryDto, UpdateSectionDto } from './dto/section.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sections')
export class SectionsController {
  constructor(private readonly academic: AcademicService) {}

  @Get()
  @RequirePermission('academic.view')
  findAll(@Query() query: ListSectionsQueryDto) {
    return this.academic.findAllSections(query);
  }

  @Post()
  @RequirePermission('academic.manage')
  create(@Body() dto: CreateSectionDto) {
    return this.academic.createSection(dto);
  }

  @Patch(':id')
  @RequirePermission('academic.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.academic.updateSection(id, dto);
  }

  @Delete(':id')
  @RequirePermission('academic.manage')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.academic.removeSection(id);
  }
}

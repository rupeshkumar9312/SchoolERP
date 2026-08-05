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
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from './dto/class.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly academic: AcademicService) {}

  @Get()
  @RequirePermission('academic.view')
  findAll(@Query() query: ListClassesQueryDto) {
    return this.academic.findAllClasses(query);
  }

  @Post()
  @RequirePermission('academic.manage')
  create(@Body() dto: CreateClassDto) {
    return this.academic.createClass(dto);
  }

  @Patch(':id')
  @RequirePermission('academic.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClassDto) {
    return this.academic.updateClass(id, dto);
  }

  @Delete(':id')
  @RequirePermission('academic.manage')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.academic.removeClass(id);
  }
}

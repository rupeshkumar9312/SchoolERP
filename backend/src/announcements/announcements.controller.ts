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
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  // No @RequirePermission on the two GET routes — every authenticated role
  // (including STUDENT/TEACHER, who hold no announcement.* permission at
  // all) may view announcements addressed to them; the service does the
  // audience scoping, same "shared route, service does the restriction"
  // pattern used for attendance/assignments elsewhere in this app.
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.announcements.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.findOne(id, user);
  }

  @Post()
  @RequirePermission('announcement.create')
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('announcement.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('announcement.delete')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.remove(id, user);
  }
}

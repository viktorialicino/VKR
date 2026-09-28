import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { Role } from '../generated/client.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { ListResourcesQueryDto } from './dto/list-resources-query.dto.js';
import { ResourcesService } from './resources.service.js';

@ApiTags('resources')
@UseGuards(JwtAuthGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  findAll(@Query() q: ListResourcesQueryDto) {
    return this.resources.findAll(q);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OFFICE_MANAGER, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateResourceDto) {
    return this.resources.create(dto);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.resources.history(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OFFICE_MANAGER, Role.ADMIN)
  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.resources.changeStatus(id, dto, user.sub);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { ListResourcesQueryDto } from './dto/list-resources-query.dto.js';
import { ResourcesService } from './resources.service.js';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  findAll(@Query() q: ListResourcesQueryDto) {
    return this.resources.findAll(q);
  }

  @Post()
  create(@Body() dto: CreateResourceDto) {
    return this.resources.create(dto);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.resources.history(id);
  }

  @Patch(':id/status')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto) {
    return this.resources.changeStatus(id, dto);
  }
}

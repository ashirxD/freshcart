import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Public, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';

/**
 * Reads are public — browsing the catalogue must not require an account.
 * Writes are ADMIN-only. Store managers get catalogue access in a later
 * milestone; the guard is the only thing that will need to change.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * `includeInactive` is honoured for staff only. A customer who guesses the
   * parameter still gets the active tree, rather than a 403 that would confirm
   * hidden categories exist.
   */
  @Public()
  @Get()
  list(@Query() query: QueryCategoriesDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.categoriesService.list(query, {
      includeInactive: query.includeInactive === true && user?.role === Role.ADMIN,
    });
  }

  @Public()
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.categoriesService.findOneOrFail(idOrSlug, {
      includeInactive: user?.role === Role.ADMIN,
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /** Bulk reorder. Declared before `:id` so the literal path wins the match. */
  @Patch('reorder')
  @Roles(Role.ADMIN)
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  /** Deactivate/reactivate. Separate from PATCH so the intent is auditable. */
  @Patch(':id/status')
  @Roles(Role.ADMIN)
  setStatus(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCategoryStatusDto) {
    return this.categoriesService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}

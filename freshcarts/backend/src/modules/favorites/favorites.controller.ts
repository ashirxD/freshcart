import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { PaginationQueryDto } from 'src/common/dto';
import { Role } from 'src/common/enums';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { FavoritesService } from './favorites.service';

/**
 * Like the cart, favourites are addressed as "mine". The owner comes from the
 * verified principal, never from the request, so one shopper cannot read or
 * modify another's list.
 */
@Controller('favorites')
@Roles(Role.CUSTOMER)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.favoritesService.list(userId, query);
  }

  /**
   * Just the ids, so a product grid can render its hearts from one small
   * response instead of asking per card.
   */
  @Get('ids')
  listIds(@CurrentUser('userId') userId: string) {
    return this.favoritesService.listIds(userId);
  }

  @Post(':productId')
  add(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.favoritesService.add(userId, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.favoritesService.remove(userId, productId);
  }
}

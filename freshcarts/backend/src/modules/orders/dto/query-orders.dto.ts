import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto';
import { OrderStatus } from '../order-status.machine';

/** Order history filters. Paginated by inheritance, so the list is always bounded. */
export class QueryOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status must be a valid order status' })
  status?: OrderStatus;
}

import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, Roles } from 'src/common/decorators';
import { Role } from 'src/common/enums';
import { QueryUsersDto, UpdateProfileDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto';
import { UsersService } from './users.service';

/**
 * Thin controller: it maps HTTP to service calls and shapes the response.
 * Every rule (uniqueness, invariants, permissions beyond the role check) lives
 * in UsersService.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Self-service: a user reading their own account. */
  @Get('me')
  async getMe(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findByIdOrFail(userId);
    return UsersService.toPublicUser(user);
  }

  /** Self-service: role, phone and status are deliberately not editable here. */
  @Patch('me')
  async updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(userId, dto);
    return UsersService.toPublicUser(user);
  }

  @Get()
  @Roles(Role.ADMIN)
  list(@Query() query: QueryUsersDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findByIdOrFail(id);
    return UsersService.toPublicUser(user);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const user = await this.usersService.updateRole(id, dto);
    return UsersService.toPublicUser(user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    const user = await this.usersService.setActive(id, dto.isActive);
    return UsersService.toPublicUser(user);
  }
}

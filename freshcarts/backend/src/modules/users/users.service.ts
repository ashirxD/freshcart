import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { Language, Role } from 'src/common/enums';
import { PasswordService } from 'src/common/security';
import { normalisePkPhone } from 'src/common/utils';
import { QueryUsersDto, UpdateProfileDto, UpdateUserRoleDto } from './dto';
import { User, UserDocument } from './schemas';

/** Input for account creation. `password` is plain text and is hashed here. */
export interface CreateUserInput {
  fullName: string;
  phone: string;
  password: string;
  email?: string;
  role?: Role;
  storeId?: string;
  preferredLanguage?: Language;
}

/** The only user shape that may cross the API boundary. */
export interface PublicUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: Role;
  isActive: boolean;
  preferredLanguage: Language;
  storeId?: string;
  phoneVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Creates an account. Role defaults to CUSTOMER — callers that want a
   * privileged role must pass it explicitly, and only ADMIN-guarded code paths do.
   */
  async create(input: CreateUserInput): Promise<UserDocument> {
    const phone = normalisePkPhone(input.phone);
    const email = input.email?.trim().toLowerCase();

    await this.assertIdentifiersAvailable(phone, email);

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      return await this.userModel.create({
        fullName: input.fullName.trim(),
        phone,
        email,
        passwordHash,
        role: input.role ?? Role.CUSTOMER,
        storeId: input.storeId ? new Types.ObjectId(input.storeId) : null,
        preferredLanguage: input.preferredLanguage ?? Language.EN,
      });
    } catch (error) {
      // Race between the pre-check above and the write: the unique index is the
      // real authority, so translate its error rather than trusting the check.
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('An account with this phone or email already exists');
      }
      throw error;
    }
  }

  findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel.findById(id).exec();
  }

  async findByIdOrFail(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Looks up an account by login identifier.
   * `withSecrets` additionally selects `passwordHash` — only the auth flow needs it.
   */
  findByPhone(
    phone: string,
    options: { withSecrets?: boolean } = {},
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ phone: normalisePkPhone(phone) });
    return (options.withSecrets ? query.select('+passwordHash') : query).exec();
  }

  /** Loads a user together with the stored refresh-token hash for rotation checks. */
  findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async setRefreshTokenHash(userId: string, refreshTokenHash: string | null): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { refreshTokenHash } }).exec();
  }

  async recordLogin(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } }).exec();
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.findByIdOrFail(userId);

    if (dto.email && dto.email !== user.email) {
      const taken = await this.userModel.exists({ email: dto.email, _id: { $ne: user._id } });
      if (taken) throw new ConflictException('This email is already in use');
      user.email = dto.email;
      user.emailVerifiedAt = null;
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.preferredLanguage !== undefined) user.preferredLanguage = dto.preferredLanguage;

    return user.save();
  }

  async list(query: QueryUsersDto): Promise<PaginatedResult<PublicUser>> {
    const filter: FilterQuery<UserDocument> = {};

    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    if (query.search) {
      // Escape the input before it becomes a RegExp: an unescaped user string is
      // both a correctness bug and a ReDoS vector.
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: pattern }, { phone: pattern }, { email: pattern }];
    }

    const [documents, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return paginated(documents.map(UsersService.toPublicUser), total, {
      page: query.page,
      limit: query.limit,
    });
  }

  /** ADMIN-only role change. Enforces the STORE_MANAGER/store invariant. */
  async updateRole(userId: string, dto: UpdateUserRoleDto): Promise<UserDocument> {
    const user = await this.findByIdOrFail(userId);

    if (dto.role === Role.STORE_MANAGER && !dto.storeId) {
      throw new BadRequestException('storeId is required when assigning the STORE_MANAGER role');
    }

    user.role = dto.role;
    user.storeId =
      dto.role === Role.STORE_MANAGER && dto.storeId ? new Types.ObjectId(dto.storeId) : null;

    // Any role change invalidates issued tokens: the old role is baked into them.
    user.refreshTokenHash = null;

    return user.save();
  }

  async setActive(userId: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.findByIdOrFail(userId);
    user.isActive = isActive;
    if (!isActive) user.refreshTokenHash = null;
    return user.save();
  }

  private async assertIdentifiersAvailable(phone: string, email?: string): Promise<void> {
    const clauses: FilterQuery<UserDocument>[] = [{ phone }];
    if (email) clauses.push({ email });

    const existing = await this.userModel.findOne({ $or: clauses }).select('phone email').exec();
    if (!existing) return;

    throw new ConflictException(
      existing.phone === phone
        ? 'An account with this phone number already exists'
        : 'An account with this email already exists',
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
    );
  }

  /** Maps a document to the safe, serialisable representation used by controllers. */
  static toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      preferredLanguage: user.preferredLanguage,
      storeId: user.storeId ? user.storeId.toString() : undefined,
      phoneVerifiedAt: user.phoneVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}

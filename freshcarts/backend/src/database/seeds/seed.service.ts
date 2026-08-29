import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { User, UserDocument } from 'src/modules/users/schemas';
import { UsersService } from 'src/modules/users/users.service';
import { buildSeedUsers } from './data/users.seed';

export interface SeedSummary {
  created: number;
  skipped: number;
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<AppConfig, true>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Idempotent by design: running the seeder twice must not create duplicates or
   * overwrite data a developer has been working with.
   */
  async run(options: { fresh?: boolean } = {}): Promise<SeedSummary> {
    this.assertNotProduction();

    if (options.fresh) {
      const { deletedCount } = await this.userModel.deleteMany({});
      this.logger.warn('Fresh seed: removed ' + deletedCount + ' existing user(s)');
    }

    let created = 0;
    let skipped = 0;

    for (const seedUser of buildSeedUsers()) {
      const existing = await this.usersService.findByPhone(seedUser.phone);

      if (existing) {
        skipped += 1;
        this.logger.log('Skipped ' + seedUser.phone + ' (already exists)');
        continue;
      }

      await this.usersService.create(seedUser);
      created += 1;
      this.logger.log('Created ' + seedUser.role + ' ' + seedUser.phone);
    }

    return { created, skipped };
  }

  /** Seeding writes known credentials — it must never touch a production database. */
  private assertNotProduction(): void {
    if (this.configService.get('isProduction', { infer: true })) {
      throw new Error('Refusing to seed: NODE_ENV is production');
    }
  }
}

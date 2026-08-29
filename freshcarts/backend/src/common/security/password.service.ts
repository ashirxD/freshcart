import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { AppConfig } from 'src/common/config/configuration';

/**
 * Single place where password material is hashed or verified.
 * Cost factor is configurable so it can be raised as hardware improves without
 * touching call sites (existing hashes keep working: the cost is stored in the hash).
 */
@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.saltRounds = configService.get('security', { infer: true }).bcryptSaltRounds;
  }

  hash(plain: string): Promise<string> {
    return hash(plain, this.saltRounds);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}

import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';

/** Cross-cutting security primitives shared by the auth and users modules. */
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class SecurityModule {}

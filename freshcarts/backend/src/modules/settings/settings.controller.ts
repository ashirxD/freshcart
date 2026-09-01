import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators';
import { SettingsService } from './settings.service';

/**
 * The public half of platform settings.
 *
 * Public because a shopper who cannot sign in is exactly the person who needs
 * the support number. Only the four fields in `publicView` are exposed; the
 * admin surface, which includes deployment facts, lives under `/admin/settings`
 * behind the ADMIN role.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public')
  publicSettings() {
    return this.settingsService.publicView();
  }
}

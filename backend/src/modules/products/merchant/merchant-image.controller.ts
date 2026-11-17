import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../common/auth/access-token.guard';
import { MerchantGuard } from '../../../common/auth/merchant.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { MerchantImageScopeGuard } from './merchant-image-scope.guard';
import { MerchantImageDto } from './merchant-image.dto';
import { MerchantImageService } from './merchant-image.service';
import { PRODUCT_IMAGE_MAX_BYTES, type MerchantImageFile } from './product-image-storage';
const { memoryStorage } = require('multer') as { memoryStorage: () => unknown };
@ApiTags('Merchant product images')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard, MerchantImageScopeGuard)
@Controller('merchant/stores/:storeId/products/:id/image')
export class MerchantImageController {
  constructor(private readonly images: MerchantImageService) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1, fields: 2, parts: 4, fieldSize: 256 },
      fileFilter: (
        _req: unknown,
        file: { mimetype: string },
        callback: (error: Error | null, accepted: boolean) => void,
      ) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('catalog.imageType'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: MerchantImageDto,
    @UploadedFile() file?: MerchantImageFile,
  ) {
    return this.images.upload(user, store, id, body, file);
  }
  @Post('remove') remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: MerchantImageDto,
  ) {
    return this.images.remove(user, store, id, body);
  }
}

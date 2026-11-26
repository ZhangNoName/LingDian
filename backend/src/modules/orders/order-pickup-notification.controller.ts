import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { OrderPickupNotificationService } from './order-pickup-notification.service';

class SubscribePickupNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  templateId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  loginCode!: string;
}

@UseGuards(AccessTokenGuard, UserApiGuard)
@Controller('customer/orders/:id/pickup-notification')
export class OrderPickupNotificationController {
  constructor(private readonly notifications: OrderPickupNotificationService) {}

  @Get()
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getSubscription(id, user.userId);
  }

  @Post()
  subscribe(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: SubscribePickupNotificationDto) {
    return this.notifications.subscribe(id, user.userId, body.templateId, body.loginCode);
  }
}

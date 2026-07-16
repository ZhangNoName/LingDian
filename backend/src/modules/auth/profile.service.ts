import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async setNickname(userId: string, nickname: string): Promise<{ nickname: string }> {
    const normalized = nickname.trim();
    if (normalized.length < 1 || normalized.length > 32) {
      throw new BadRequestException('Nickname must contain 1 to 32 characters.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: normalized },
      select: { nickname: true },
    });
    return { nickname: user.nickname! };
  }
}

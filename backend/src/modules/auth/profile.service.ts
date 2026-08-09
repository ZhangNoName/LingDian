import { BadRequestException, Injectable } from '@nestjs/common';
import type { CustomerProfile } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';

type AvatarUpload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

  async get(userId: string): Promise<CustomerProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { nickname: true, avatarData: true, avatarMimeType: true },
    });
    return toCustomerProfile(user);
  }

  async setAvatar(userId: string, file: AvatarUpload | undefined): Promise<CustomerProfile> {
    if (!file?.buffer?.length || file.size < 1) {
      throw new BadRequestException('Avatar file is required.');
    }
    if (file.size > AVATAR_MAX_BYTES || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar must not exceed 512 KiB.');
    }
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Avatar must be a JPEG, PNG, or WebP image.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarData: Uint8Array.from(file.buffer), avatarMimeType: file.mimetype },
      select: { nickname: true, avatarData: true, avatarMimeType: true },
    });
    return toCustomerProfile(user);
  }
}

function toCustomerProfile(user: {
  nickname: string | null;
  avatarData: Uint8Array | null;
  avatarMimeType: string | null;
}): CustomerProfile {
  return {
    nickname: user.nickname,
    avatar_data_url: user.avatarData && user.avatarMimeType
      ? `data:${user.avatarMimeType};base64,${Buffer.from(user.avatarData).toString('base64')}`
      : null,
  };
}

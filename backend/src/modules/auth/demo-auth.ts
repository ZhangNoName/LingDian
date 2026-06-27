import { UnauthorizedException } from '@nestjs/common';

export const DEMO_TOKEN = 'demo-token';

export type DemoUser = {
  name: string;
  mobile: string;
};

export function resolveDemoUser(authorization?: string): DemoUser {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();

  if (token !== DEMO_TOKEN) {
    throw new UnauthorizedException('Invalid demo token');
  }

  return {
    name: '演示用户',
    mobile: '13800000000',
  };
}


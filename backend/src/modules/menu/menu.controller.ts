import { Controller, Get } from '@nestjs/common';

@Controller('menu')
export class MenuController {
  @Get('current')
  getCurrentMenu() {
    return {
      menuVersion: '2026-spring',
      categories: [
        {
          id: 'c1',
          name: '招牌主食',
          items: [
            {
              id: 'sku-001',
              name: '炙烤鸡腿饭',
              price: 29.9,
              tags: ['招牌', '热销'],
              available: true,
            },
            {
              id: 'sku-002',
              name: '黑椒牛肉意面',
              price: 32.0,
              tags: ['新品'],
              available: true,
            },
          ],
        },
        {
          id: 'c2',
          name: '小吃饮品',
          items: [
            {
              id: 'sku-101',
              name: '现炸薯条',
              price: 12.0,
              tags: ['加购推荐'],
              available: true,
            },
          ],
        },
      ],
    };
  }
}

import { Controller, Get, Req, Res } from '@nestjs/common';
import { MetricsService } from './metrics.service';

type MetricsResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): MetricsResponse;
  send(body: string): void;
};

type MetricsRequest = {
  originalUrl?: string;
  url?: string;
};

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(
    @Req() request: MetricsRequest,
    @Res() response: MetricsResponse,
  ): Promise<void> {
    const pathname = (request.originalUrl ?? request.url ?? '').split('?', 1)[0];
    if (pathname !== '/api/metrics') {
      response.status(404).send('Not Found');
      return;
    }
    response.setHeader('Content-Type', this.metrics.contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).send(await this.metrics.render());
  }
}

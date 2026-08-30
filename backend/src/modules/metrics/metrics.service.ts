import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export type HttpMetricLabels = {
  method: string;
  route: string;
  statusCode: string;
};

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly requests = new Counter({
    name: 'lingdian_http_requests_total',
    help: 'Total number of HTTP responses produced by the LingDian API.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });
  private readonly duration = new Histogram({
    name: 'lingdian_http_request_duration_seconds',
    help: 'LingDian API HTTP response duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'lingdian-api' });
    collectDefaultMetrics({ register: this.registry });
  }

  observeHttpRequest(labels: HttpMetricLabels, durationSeconds: number): void {
    const metricLabels = {
      method: labels.method,
      route: labels.route,
      status_code: labels.statusCode,
    };
    this.requests.inc(metricLabels);
    this.duration.observe(metricLabels, durationSeconds);
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}

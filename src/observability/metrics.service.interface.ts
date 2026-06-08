export const METRICS_SERVICE = Symbol('METRICS_SERVICE');

export type Labels = Readonly<Record<string, string | number | boolean>>;

export interface MetricsService {
  counter(name: string, labels?: Labels): void;
  histogram(name: string, value: number, labels?: Labels): void;
  gauge(name: string, value: number, labels?: Labels): void;
}

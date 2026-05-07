export type StatisticsStatus = {
  loading: boolean;
  error: string;
};

export type StatsRow = {
  value: string;
  count: number;
  isOther?: boolean;
};

export type PriceBucket = {
  key: string;
  min: number;
  max: number;
  count: number;
};

export type SearchStatsResponse = {
  total?: number;
  stats?: Record<string, StatsRow[]>;
  priceBuckets?: PriceBucket[];
};

export type StatisticsState = {
  total: number;
  stats: Record<string, StatsRow[]>;
  priceBuckets: PriceBucket[];
};

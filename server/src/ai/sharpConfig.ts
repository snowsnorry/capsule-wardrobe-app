import sharp from "sharp";

const SHARP_CONCURRENCY =
  Number.parseInt(process.env.SHARP_CONCURRENCY || "", 10) || 2;

function configureSharp(overrideConcurrency: number | null = null) {
  const concurrency =
    Number.isInteger(overrideConcurrency) && overrideConcurrency > 0
      ? overrideConcurrency
      : SHARP_CONCURRENCY;

  sharp.cache(false);
  sharp.concurrency(concurrency);

  return {
    cache: sharp.cache(),
    concurrency: sharp.concurrency(),
  };
}

export { SHARP_CONCURRENCY, configureSharp };

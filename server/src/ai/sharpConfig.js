import sharp from "sharp";

const SHARP_CONCURRENCY = Number.parseInt(process.env.SHARP_CONCURRENCY || "", 10) || 2;

function configureSharp() {
  sharp.cache(false);
  sharp.concurrency(SHARP_CONCURRENCY);

  return {
    cache: sharp.cache(),
    concurrency: sharp.concurrency()
  };
}

export {
  SHARP_CONCURRENCY,
  configureSharp
};

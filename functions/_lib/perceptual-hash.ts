// #3552 phase 4: a perceptual (difference-hash / "dHash") for cross-source
// duplicate detection -- the same real-world photo found on two different
// platforms has two different bytes (different compression, crop, or
// resolution) and therefore two different media_uid content hashes, so
// exact-hash dedup (media-ingest-repository.ts) can never catch it. dHash
// is robust to those differences because it only compares the relative
// brightness of adjacent pixels after downscaling, not the raw bytes.
//
// This is a similarity SIGNAL for a human reviewer, never an automatic
// reject: two genuinely different photos of the same subject/pose can
// legitimately land within the same distance threshold as two copies of
// the same photo. See content-pipeline-duplicate-detection.ts, which is
// what actually decides what a close hash means.

import { Jimp } from 'jimp';

// 9x8 downscale -> 8 horizontal comparisons per row x 8 rows = 64 bits,
// encoded as 16 lowercase hex characters. Standard dHash dimensions.
const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

// BigInt(0)/BigInt(1) rather than 0n/1n literals -- literal suffix syntax
// requires an ES2020+ compile target; this repo targets ES2017.
const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);

export async function computePerceptualHash(bytes: Uint8Array): Promise<string> {
  const image = await Jimp.read(Buffer.from(bytes));
  image.resize({ w: HASH_WIDTH, h: HASH_HEIGHT }).greyscale();

  let hash = BIG_ZERO;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const left = image.getPixelColor(x, y);
      const right = image.getPixelColor(x + 1, y);
      // getPixelColor returns a packed 0xRRGGBBAA int; greyscale() makes
      // R/G/B identical, so the top byte alone is the pixel's brightness.
      const leftBrightness = (left >>> 24) & 0xff;
      const rightBrightness = (right >>> 24) & 0xff;
      hash = (hash << BIG_ONE) | (leftBrightness < rightBrightness ? BIG_ONE : BIG_ZERO);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

export function hammingDistanceHex(hashA: string, hashB: string): number {
  const a = BigInt(`0x${hashA}`);
  const b = BigInt(`0x${hashB}`);
  let xor = a ^ b;
  let distance = 0;
  while (xor > BIG_ZERO) {
    distance += Number(xor & BIG_ONE);
    xor >>= BIG_ONE;
  }
  return distance;
}

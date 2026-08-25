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

// jimp was tried first but is unusable here: its package.json "exports"
// map has a "browser" condition pointing at an empty stub
// (`export {};  // A stub. The real build is done by rollup.`), and
// Cloudflare's Pages Functions bundler (`wrangler pages functions build`,
// confirmed locally against the real bundler, not just a generic esbuild
// invocation) resolves that condition -- breaking `import { Jimp } from
// 'jimp'` with "No matching export ... for import Jimp" at deploy time.
// @cf-wasm/photon is a Rust/WASM image library purpose-built for Workers:
// its exports map has no "browser" stub (its "default" condition itself
// points at the real workerd build), and its `.wasm` import is handled by
// Wrangler's built-in Wasm module loader. The bare `@cf-wasm/photon`
// specifier is used (rather than hardcoding the `/workerd` subpath) so it
// also resolves to the `/node` build's Node-safe wasm loading under
// Vitest, which -- unlike Wrangler -- has no loader for a raw `.wasm` ES
// module import.
import { PhotonImage, SamplingFilter, grayscale, resize } from '@cf-wasm/photon';

// 9x8 downscale -> 8 horizontal comparisons per row x 8 rows = 64 bits,
// encoded as 16 lowercase hex characters. Standard dHash dimensions.
const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

// BigInt(0)/BigInt(1) rather than 0n/1n literals -- literal suffix syntax
// requires an ES2020+ compile target; this repo targets ES2017.
const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);

export async function computePerceptualHash(bytes: Uint8Array): Promise<string> {
  const decoded = PhotonImage.new_from_byteslice(bytes);
  const resized = resize(decoded, HASH_WIDTH, HASH_HEIGHT, SamplingFilter.Nearest);
  decoded.free();
  grayscale(resized);
  // Raw pixels are row-major RGBA, 4 bytes/pixel; grayscale() makes R/G/B
  // identical, so the R channel alone is the pixel's brightness.
  const pixels = resized.get_raw_pixels();
  resized.free();

  let hash = BIG_ZERO;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const leftBrightness = pixels[(y * HASH_WIDTH + x) * 4];
      const rightBrightness = pixels[(y * HASH_WIDTH + x + 1) * 4];
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

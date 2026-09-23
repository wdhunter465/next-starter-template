import type { NextConfig } from "next";
import { resolveGaMeasurementId } from "./src/lib/gaMeasurementId";

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_GA_ID: resolveGaMeasurementId(process.env),
	},
	/* Cloudflare Pages site build; runtime APIs are served by Cloudflare Pages Functions (`functions/api/**`). */
	output: "export",
  trailingSlash: true, // Keep trailing slashes in generated static routes
	images: {
		unoptimized: true, // Required for Cloudflare Pages (no Node.js image optimization)
	},
	// Static assets are exported, while read/write behavior remains on Pages Functions.
};

export default nextConfig;

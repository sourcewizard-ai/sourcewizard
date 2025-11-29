import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Use assetPrefix to load assets from planner's own domain
  // This allows the HTML to be served through rewrite while assets load directly
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || (
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_DEV_HOST
        ? `http://${process.env.NEXT_PUBLIC_DEV_HOST}:3001`
        : 'http://localhost:3001'
      : 'https://sourcewizard-planner.vercel.app'
  ),
};

export default nextConfig;

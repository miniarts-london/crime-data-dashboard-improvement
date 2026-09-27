import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is started as localhost, but the in-browser preview opens
  // 127.0.0.1. Without this, Next blocks the dev websocket and the page stays
  // on the server HTML, so the map (client-only) never mounts.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;

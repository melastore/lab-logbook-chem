import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,

  // Security headers are set per-request in src/middleware.ts, because the CSP
  // carries a fresh nonce each time and cannot be a static value here.
};

export default nextConfig;

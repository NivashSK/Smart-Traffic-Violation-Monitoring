import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
      {
        source: "/data/:path*",
        destination: "http://127.0.0.1:8000/data/:path*",
      },
    ];
  },
};

export default nextConfig;

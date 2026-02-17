/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy API requests to Python backend in development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:9002/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;

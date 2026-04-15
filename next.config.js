/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'ijdscgzpswlskwaozbuh.supabase.co' },
    ],
  },
  transpilePackages: ['lucide-react'],
  compress: true,
  poweredByHeader: false,
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Category and product imagery is uploaded to object storage and served by
    // the API host; add concrete hostnames as integrations land.
    remotePatterns: [],
  },
};

export default nextConfig;

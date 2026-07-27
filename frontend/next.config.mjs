/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Avatar hosts: Google (YouTube sign-in), Twitch, and Supabase storage.
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;

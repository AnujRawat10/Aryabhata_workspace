/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep Prisma out of the server bundle so its query engine resolves correctly
  // at runtime on Amplify/Lambda (avoids "query engine binary not found").
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default config;

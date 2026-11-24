import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    authInterrupts: true,
    // Impor komponen flowbite-react per modul (kompilasi dev lebih cepat, bundle lebih kecil).
    optimizePackageImports: ["flowbite-react"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withFlowbiteReact(nextConfig);
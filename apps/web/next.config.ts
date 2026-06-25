import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared design-token / types package (it ships TS source).
  transpilePackages: ["@pore/shared"],
};

export default nextConfig;

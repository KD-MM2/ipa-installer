import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    env: {
        NEXT_PHASE: process.env.NEXT_PHASE
    }
};

export default nextConfig;

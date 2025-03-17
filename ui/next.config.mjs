/** @type {import('next').NextConfig} */

const nextConfig = {
    // async redirects() {
    //   return [
    //     {
    //       source: '/',
    //       destination: '/services/catalog',
    //       permanent: false,
    //     },
    //   ];
    // },
    // Technically standlone only during docker build
    // Nexus https://github.com/openai/openai/blob/90d8f350910e0521182f255c50aa12e82c19b72b/api/nexus/nexus-web/next.config.mjs#L12
    // has it commented out and then uncomments it in the Dockerfile. Not sure if that's worth doing.
    // output: 'standalone',

    // We use export mode because we want to build a set of assets to be served from a static server
    output: 'export',
    // Extend the Webpack configuration
    webpack: (config) => {
      // Prioritize ESM over CommonJS
      config.resolve.mainFields = ['browser', 'module', 'main'];
      return config;
    },
  };

  
export default nextConfig;

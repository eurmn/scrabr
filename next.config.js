/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { dev, isServer, webpack, nextRuntime }) => {
        config.module.rules.push({
          test: /\.node$/,
          use: [
            {
              loader: "nextjs-node-loader"
            },
          ],
        });

        config.module.rules.push(      {
          test: /\.(jpe?g|png|svg|gif|ico|eot|ttf|woff|woff2|mp4|pdf|webm|mp3)$/,
          use: [
            {
              loader: 'file-loader',
            },
          ],
        });

        return config;
    }
}

module.exports = nextConfig

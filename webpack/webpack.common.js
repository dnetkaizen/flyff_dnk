const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (browser) => ({
    mode: "production",
    entry: {
        flyff: path.resolve(__dirname, "..", "src", "flyff.ts"),
    },
    output: {
        path: path.join(__dirname, "../dist", browser),
        filename: "[name].js",
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.(sass|less|css)$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /monster_template\.(png|jpg)$/i,
                type: 'asset/inline'
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/[name][ext]'
                }
            }
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: ".",
                    to: ".",
                    context: "public"
                },
                {
                    from: "assets",
                    to: "assets",
                    noErrorOnMissing: true
                }
            ]
        }),
    ],
});
require("ts-node").register({
    files: true,
});

const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: "9650/ext/bc/2E3GFQkmeqUERv8jDWxWt7ZnmW6Xe2xUR7npNkTMXvbdKjeWw6/rpc",
            network_id: "43214", // The chain ID of the example private blockchain that ava-sim provides out of the box.
            provider: () =>
                new HDWalletProvider(
                    "56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", // The private key that ava-sim provides for testing
                    "http://127.0.0.1:9650/ext/bc/2E3GFQkmeqUERv8jDWxWt7ZnmW6Xe2xUR7npNkTMXvbdKjeWw6/rpc"
                ),
        },
    },

    mocha: {},

    compilers: {
        solc: {
            version: "0.8.0",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 999999999,
                },
            },
        },
    },
};

require("ts-node").register({
    files: true,
});

const HDWalletProvider = require("@truffle/hdwallet-provider");
const testAccountsData = require("./test/data/test-accounts-data").testAccountsData;
const config = require("./config").config;

// @NOTE: We use a subnet and private chain for the local development environment because ava-sim doesn't let us create 10 accounts with balances
// if we run the standard network. ava-sim only allows this via the "alloc" key in the genesis configuration, and there is only a genesis
// configuration available to edit for the subnet-evm script

module.exports = {
    plugins: ["truffle-plugin-verify"],

    api_keys: {
        etherscan: process.env.SNOWTRACE_API_KEY,
    },
    networks: {
        development: {
            provider: () =>
                new HDWalletProvider(
                    testAccountsData.map(({ privateKey }) => privateKey),
                    config.AVAX.localHTTP
                ),
            network_id: "*",
            gas: 6721975,
            skipDryRun: true,
        },
        developmentGanache: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*",
            gas: 6721975,
            skipDryRun: true,
        },
        testnet: {
            provider: () => new HDWalletProvider(testAccountsData[1].privateKey, config.AVAX.testnetHTTP),
            network_id: "*",
            gas: 6721975,
            skipDryRun: true,
        },
        // mainnet: {
        //     provider: () => new HDWalletProvider(keys.masterKey, config.AVAX.mainnetHTTP),
        //     network_id: "*", // Any network (default: none)
        //     gas: 6721975,
        //     skipDryRun: true,
        // },
    },
    compilers: {
        solc: {
            version: "0.8.1",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 999999999,
                },
            },
        },
    },
};

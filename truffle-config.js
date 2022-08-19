require('ts-node').register({
    files: true,
});

const HDWalletProvider = require('@truffle/hdwallet-provider');
const testAccountsData = require('./test/data/test-accounts-data').testAccountsData;
const testPrivateAccountsData = require('./test-master-keys').testMasterKeys;
const config = require('./config').config;

// @NOTE: We use a subnet and private chain for the local development environment because ava-sim doesn't let us create 10 accounts with balances
// if we run the standard network. ava-sim only allows this via the "alloc" key in the genesis configuration, and there is only a genesis
// configuration available to edit for the subnet-evm script

module.exports = {
    plugins: ['truffle-plugin-verify', 'truffle-contract-size'],

    api_keys: {
        etherscan: process.env.SNOWTRACE_API_KEY,
    },
    networks: {
        development: {
            provider: () =>
                new HDWalletProvider(
                    testAccountsData.map(({ privateKey }) => privateKey),
                    config.AVAX.localSubnetHTTP
                ),
            network_id: '*',
            gas: 6721975,
            skipDryRun: true,
        },
        developmentGanache: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*',
            gas: 6721975,
            skipDryRun: true,
        },
        testnet: {
            provider: () =>
                new HDWalletProvider(
                    [
                        testPrivateAccountsData.privateTestAccount1.privateKey,
                        testPrivateAccountsData.privateTestAccount2.privateKey,
                        testPrivateAccountsData.privateTestAccount3.privateKey,
                        testPrivateAccountsData.privateTestAccount4.privateKey,
                        testPrivateAccountsData.privateTestAccount5.privateKey,
                        testPrivateAccountsData.privateTestAccount6.privateKey,
                        testPrivateAccountsData.privateTestAccount7.privateKey,
                        testPrivateAccountsData.privateTestAccount8.privateKey,
                        testPrivateAccountsData.privateTestAccount9.privateKey,
                        testPrivateAccountsData.privateTestAccount10.privateKey,
                    ],
                    config.AVAX.testnetHTTP
                ),
            // provider: () => new HDWalletProvider([testAccountsData[0].privateKey, testAccountsData[1].privateKey, testAccountsData[2].privateKey], config.AVAX.testnetHTTP),
            network_id: '*',
            // gas: 6721975,
            gas: 8000000,
            skipDryRun: true,
            networkCheckTimeout: 1000000,
            timeoutBlocks: 200,
        },
        testnetSubnet: {
            provider: () =>
                new HDWalletProvider(
                    [
                        testPrivateAccountsData.privateTestAccount1.privateKey,
                        testPrivateAccountsData.privateTestAccount2.privateKey,
                        testPrivateAccountsData.privateTestAccount3.privateKey,
                        testPrivateAccountsData.privateTestAccount4.privateKey,
                        testPrivateAccountsData.privateTestAccount5.privateKey,
                        testPrivateAccountsData.privateTestAccount6.privateKey,
                        testPrivateAccountsData.privateTestAccount7.privateKey,
                        testPrivateAccountsData.privateTestAccount8.privateKey,
                        testPrivateAccountsData.privateTestAccount9.privateKey,
                        testPrivateAccountsData.privateTestAccount10.privateKey,
                    ],
                    config.AVAX.testnetSubnetHTTP
                ),
            // provider: () => new HDWalletProvider([testAccountsData[0].privateKey, testAccountsData[1].privateKey, testAccountsData[2].privateKey], config.AVAX.testnetHTTP),
            network_id: '*',
            // gas: 6721975,
            gas: 8000000,
            skipDryRun: true,
            networkCheckTimeout: 1000000,
            timeoutBlocks: 200,
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
            version: 'pragma', // Will use the relevant compiler version for each contract (experimental feature in truffle v5.2.0)
            settings: {
                optimizer: {
                    enabled: true,
                    // runs: 999999999, // max runs
                    // runs: 200, // default runs
                    runs: 20000,
                },
            },
        },
    },
};

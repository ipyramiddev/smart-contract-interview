require("ts-node").register({
    files: true,
});

const HDWalletProvider = require("@truffle/hdwallet-provider");

const testAccounts = {
    "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC": { privateKey: "56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027" },
    "0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9": { privateKey: "6d2b38b529d2094dcd029f7667893a03189ba1c5d09ee2ff9f3612651900e3cb" },
    "0x769fd6cc56e084119dd7669ddb9a9f37d5827db2": { privateKey: "657907b649d69704ebf69a2202edefa75635828a3d5718fcfaa58b347fa97831" },
    "0xb7a61e70d2c5c53bf5787f208d91ff89d886e68c": { privateKey: "5e1b5598ea537b689cc6328835575072f40e3d639e6da70efae8781106d1d289" },
    "0xbc109315617bf4d0bddabe29f5315355f08544cd": { privateKey: "8fafa2e4c0b1fb792c31efd4fa377e81e21d17316a45d72c805210d414db0bff" },
    "0xb2ea8a1467db745b18800c812414438e4a31f8bb": { privateKey: "fe41142b19245c6d90415ebeb08753a95a8ae57bba383a1b0c176f2e414a67dd" },
    "0x41929c5438d898a62c8eb126f4ce5150348b72f5": { privateKey: "baf07f3c8b442025c3d5801c89f648328a63a771bd9eedb2537cc334505d6184" },
    "0xe3697cb32ab0a61364914b29e16c4ca78fbd558f": { privateKey: "c6d418ac45c3e20182e3d261babd408a2fef8c220423f9a58519968ae7aa4f82" },
    "0x5bdfd6cd7567fd9255f854edb77890873751eaf6": { privateKey: "c72ee066a08c9810a099771594deffc77c7da9f422df3ed985082fb7df301af0" },
    "0xb7b6108abead130d9826a0d78745ad68b21d9c12": { privateKey: "01975bf8d6991196f8d6d3fddc837a8305ae4da3c5ff95a2dad462d740574c0e" },
};

// @NOTE: We use a subnet and private chain for the local development environment because ava-sim doesn't let us create 10 accounts with balances
// if we run the standard network. ava-sim only allows this via the "alloc" key in the genesis configuration, and there is only a genesis
// configuration available to edit for the subnet-evm script
const privateTestBlockchainId = "8s5k1kJ96eoL6Y4J9qXWshGKi2QSRwqvVHfXEqT56pMiFEfy5";

module.exports = {
    plugins: ["truffle-plugin-verify"],

    api_keys: {
        etherscan: process.env.SNOWTRACE_API_KEY,
    },
    networks: {
        development: {
            provider: () =>
                new HDWalletProvider(
                    Object.values(testAccounts).map(({ privateKey }) => privateKey),
                    `http://127.0.0.1:9650/ext/bc/${privateTestBlockchainId}/rpc`
                ),
            network_id: "*",
            gas: 6721975,
            skipDryRun: true,
        },
        testnet: {
            provider: () => new HDWalletProvider(testAccounts["0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9"].privateKey, "https://api.avax-test.network/ext/bc/C/rpc"),
            network_id: "*",
            gas: 6721975,
            skipDryRun: true,
        },
        // mainnet: {
        //     provider: () => new HDWalletProvider(keys.masterKey, "https://api.avax.network/ext/bc/C/rpc"),
        //     network_id: "*", // Any network (default: none)
        //     gas: 6721975,
        //     skipDryRun: true,
        // },
    },
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

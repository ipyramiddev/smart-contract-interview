require("ts-node").register({
    files: true,
});

const HDWalletProvider = require("@truffle/hdwallet-provider");

const testAccounts = {
    "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC": { privateKey: "56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027" },
    "0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9": { privateKey: "6d2b38b529d2094dcd029f7667893a03189ba1c5d09ee2ff9f3612651900e3cb" },
    "0xb7a61e70d2c5c53bf5787f208d91ff89d886e68c": { privateKey: "657907b649d69704ebf69a2202edefa75635828a3d5718fcfaa58b347fa97831" },
    "0xbc109315617bf4d0bddabe29f5315355f08544cd": { privateKey: "5e1b5598ea537b689cc6328835575072f40e3d639e6da70efae8781106d1d289" },
    "0xb2ea8a1467db745b18800c812414438e4a31f8bb": { privateKey: "8fafa2e4c0b1fb792c31efd4fa377e81e21d17316a45d72c805210d414db0bff" },
    "0x41929c5438d898a62c8eb126f4ce5150348b72f5": { privateKey: "fe41142b19245c6d90415ebeb08753a95a8ae57bba383a1b0c176f2e414a67dd" },
    "0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9": { privateKey: "baf07f3c8b442025c3d5801c89f648328a63a771bd9eedb2537cc334505d6184" },
    "0xe3697cb32ab0a61364914b29e16c4ca78fbd558f": { privateKey: "c6d418ac45c3e20182e3d261babd408a2fef8c220423f9a58519968ae7aa4f82" },
    "0x5bdfd6cd7567fd9255f854edb77890873751eaf6": { privateKey: "c72ee066a08c9810a099771594deffc77c7da9f422df3ed985082fb7df301af0" },
    "0xb7b6108abead130d9826a0d78745ad68b21d9c12": { privateKey: "01975bf8d6991196f8d6d3fddc837a8305ae4da3c5ff95a2dad462d740574c0e" },
};

const privateTestBlockchainId = "wG5KnZ9m8g25tLnwRrUQcr1pBn4CjT6wN68aMJDjRpdb1dqtz";

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: `9650/ext/bc/${privateTestBlockchainId}/rpc`,
            network_id: "43214", // The chain ID of the example private blockchain that ava-sim provides out of the box.
            provider: () =>
                new HDWalletProvider(
                    Object.values(testAccounts).map(({ privateKey }) => privateKey),
                    `http://127.0.0.1:9650/ext/bc/${privateTestBlockchainId}/rpc`
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

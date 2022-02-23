type Network = "development" | "mainnet";

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const PFT = artifacts.require("PFT");
        await deployer.deploy(PFT);

        const PORB = artifacts.require("PORB");
        await deployer.deploy(PORB);
    };
};

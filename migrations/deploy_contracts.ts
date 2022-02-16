type Network = "development" | "mainnet";

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const PORB = artifacts.require("PORB");

        await deployer.deploy(PORB);

        const PORBInstance = await PORB.deployed();
        console.log(`Metacoin deployed at ${PORBInstance.address} in network: ${network}.`);
    };
};

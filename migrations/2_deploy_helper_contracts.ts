import { Network } from './types';

// @NOTE: Remember to reinstate any commented out deployment scripts if you're going to run the corresponding test suite for that contract
// Otherwise the contract state won't be reset after each run and tests will likely fail!

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const multicall2 = artifacts.require('Multicall2');
        await deployer.deploy(multicall2);
    };
};

type Network = 'development' | 'mainnet';

// @NOTE: Remember to reinstate any commented out deployment scripts if you're going to run the corresponding test suite for that contract
// Otherwise the contract state won't be reset after each run and tests will likely fail!

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const multiSigWallet = artifacts.require('MultiSigWallet');
        const owners = [accounts[0], accounts[1], accounts[2]];
        const requiredThreshold = 2;
        await deployer.deploy(multiSigWallet, owners, requiredThreshold);
        const multiSigWalletInstance = await multiSigWallet.deployed();

        const PFT = artifacts.require('PFT');
        await deployer.deploy(PFT);
        const PFTInstance = await PFT.deployed();
        await PFTInstance.transferOwnership(multiSigWalletInstance.address);

        const PORB = artifacts.require('PORB');
        await deployer.deploy<any[]>(PORB, accounts[1], multiSigWalletInstance.address);
        const PORBInstance = await PORB.deployed();
        await PORBInstance.addController(accounts[0]); // @TODO: Remove when testing complete
        await PORBInstance.mint(accounts[0], web3.utils.toWei('1', 'ether')); // @TODO: Remove when testing complete
        await PORBInstance.mint(multiSigWalletInstance.address, web3.utils.toWei('1000000000', 'ether')); // @TODO: Remove when testing complete
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);

        const hero = artifacts.require('Hero');
        await deployer.deploy<any[]>(hero, PORB.address, multiSigWalletInstance.address);
        const heroInstance = await hero.deployed();
        await heroInstance.transferOwnership(multiSigWalletInstance.address);

        const architect = artifacts.require('Architect');
        await deployer.deploy<any[]>(architect, PORB.address, multiSigWalletInstance.address);
        const architectInstance = await architect.deployed();
        await architectInstance.transferOwnership(multiSigWalletInstance.address);

        const porble = artifacts.require('Porble');
        await deployer.deploy<any[]>(porble, accounts[1]);
        const porbleInstance = await porble.deployed();
        await porbleInstance.transferOwnership(multiSigWalletInstance.address);

        const VestingVault = artifacts.require('VestingVault');
        await deployer.deploy(VestingVault, PFTInstance.address);
        const vestingVaultInstance = await VestingVault.deployed();
        await vestingVaultInstance.transferOwnership(multiSigWalletInstance.address);
    };
};

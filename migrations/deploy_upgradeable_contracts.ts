import { Network } from './types';
import { deployProxy } from '@openzeppelin/truffle-upgrades';

// @NOTE: Remember to reinstate any commented out deployment scripts if you're going to run the corresponding test suite for that contract
// Otherwise the contract state won't be reset after each run and tests will likely fail!

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const multiSigWallet = artifacts.require('MultiSigWallet');
        const owners = [accounts[0], accounts[1], accounts[2]];
        const requiredThreshold = 2;
        await deployer.deploy(multiSigWallet, owners, requiredThreshold);
        const multiSigWalletInstance = await multiSigWallet.deployed();

        const WAVAX = artifacts.require('WAVAX');
        await deployer.deploy(WAVAX);
        const WAVAXInstance = await WAVAX.deployed();

        const PFTUpgradeable = artifacts.require('PFTUpgradeable');
        const PFTUpgradeableInstance = await deployProxy(PFTUpgradeable as any, [], { deployer: deployer as any, initializer: 'initialize' });
        await PFTUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const PORBUpgradeable = artifacts.require('PORBUpgradeable');
        await deployer.deploy<any[]>(PORBUpgradeable, accounts[1], multiSigWalletInstance.address);
        const PORBUpgradeableInstance = await deployProxy(PORBUpgradeable as any, [accounts[1], multiSigWalletInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const heroUpgradeable = artifacts.require('HeroUpgradeable');
        const heroUpgradeableInstance = await deployProxy(heroUpgradeable as any, [PORBUpgradeable.address, multiSigWalletInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await heroUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const architectUpgradeable = artifacts.require('ArchitectUpgradeable');
        const architectUpgradeableInstance = await deployProxy(architectUpgradeable as any, [PORBUpgradeable.address, multiSigWalletInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await architectUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const cosmeticsUpgradeable = artifacts.require('CosmeticsUpgradeable');
        const cosmeticsUpgradeableInstance = await deployProxy(cosmeticsUpgradeable as any, [PORBUpgradeable.address, multiSigWalletInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await cosmeticsUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const porbleUpgradeable = artifacts.require('PorbleUpgradeable');
        const porbleUpgradeableInstance = await deployProxy(porbleUpgradeable as any, [accounts[1], multiSigWalletInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await porbleUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');
        const NFTMarketplaceUpgradeableInstance = await deployProxy(NFTMarketplaceUpgradeable as any, [WAVAXInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await NFTMarketplaceUpgradeableInstance.updateCollectionsWhitelist(heroUpgradeableInstance.address, true);
        await NFTMarketplaceUpgradeableInstance.updateCollectionsWhitelist(architectUpgradeableInstance.address, true);
        await NFTMarketplaceUpgradeableInstance.updateCollectionsWhitelist(porbleUpgradeableInstance.address, true);
        await NFTMarketplaceUpgradeableInstance.updateCollectionsWhitelist(cosmeticsUpgradeableInstance.address, true);
        await NFTMarketplaceUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const VestingVaultUpgradeable = artifacts.require('VestingVaultUpgradeable');
        const vestingVaultUpgradeableInstance = await deployProxy(VestingVaultUpgradeable as any, [PFTUpgradeableInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        });
        await vestingVaultUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
    };
};

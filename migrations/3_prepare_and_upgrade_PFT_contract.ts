import { admin, prepareUpgrade } from '@openzeppelin/truffle-upgrades';
import { Network } from './types';
import { getTxIdFromMultiSigWallet } from '../test/lib/test-helpers';

const PFT_TRANSPARENT_PROXY_ADDRESS = '0x6E65a3F8aCB801A8B6bA4fcc9374D9Cf7232BB5E';

module.exports = (artifacts: Truffle.Artifacts) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        // Running only in testnet so that this isn't run on every test, not is it run on mainnet
        if (network === 'testnet') {
            const PFTUpgradeableTest = artifacts.require('PFTUpgradeableTest');
            const PFTUpgradeableTestInstanceAddress = await prepareUpgrade(PFT_TRANSPARENT_PROXY_ADDRESS, PFTUpgradeableTest as any, { deployer: deployer as any });
            console.log(`Prepared upgrade of the PFTUpgradeable contract: ${PFTUpgradeableTestInstanceAddress}`);

            // Upgrade contract via a multisig
            const MultiSigWallet = artifacts.require('MultiSigWallet');
            const multiSigWalletInstance = await MultiSigWallet.deployed();
            const adminInstance = await admin.getInstance();
            const data = await adminInstance.contract.methods.upgrade(PFT_TRANSPARENT_PROXY_ADDRESS, PFTUpgradeableTestInstanceAddress).encodeABI();
            await multiSigWalletInstance.submitTransaction(adminInstance.address, 0, data, { from: accounts[0] });
            const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
            await multiSigWalletInstance.confirmTransaction(txId, { from: accounts[1] });
            console.log('Upgraded contract');
        }
    };
};

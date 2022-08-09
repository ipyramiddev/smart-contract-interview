const testMasterKeys = require('../test-master-keys').testMasterKeys;

const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xd32972eC98A74928fCdb0C4Acbf155a473b1352e';
const MULTISIG_WALLET_ADDRESS = '0x7fc10Be12B9D8dCA7D77e5eD209f3e3FD09F2680';

module.exports = async function (callback) {
    try {
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);
        console.log(`Current owner: ${await PFTUpgradeableInstance.owner()}`);
        await PFTUpgradeableInstance.transferOwnership(MULTISIG_WALLET_ADDRESS, { from: testMasterKeys.privateTestAccount1.address });
    } catch (error) {
        console.log(error);
    }

    callback();
};

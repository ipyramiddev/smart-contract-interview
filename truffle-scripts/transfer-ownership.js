const testMasterKeys = require('../test-master-keys').testMasterKeys;

const GenericContractUpgradeable = artifacts.require('USDPUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const GENERIC_CONTRACT_TRANSPARENT_PROXY_ADDRESS = '0xA5902870E3D5E086f706cCB770F1404b71658db6';
const MULTISIG_WALLET_ADDRESS = '0x7fc10Be12B9D8dCA7D77e5eD209f3e3FD09F2680';

module.exports = async function (callback) {
    try {
        const GenericContractUpgradeableInstance = await GenericContractUpgradeable.at(GENERIC_CONTRACT_TRANSPARENT_PROXY_ADDRESS);
        console.log(`Current owner: ${await GenericContractUpgradeableInstance.owner()}`);
        await GenericContractUpgradeableInstance.transferOwnership(MULTISIG_WALLET_ADDRESS, { from: testMasterKeys.privateTestAccount1.address });
    } catch (error) {
        console.log(error);
    }

    callback();
};

const Web3 = require('web3');
const testMasterKeys = require('../test-master-keys').testMasterKeys;

const TokenUpgradeable = artifacts.require('USDPUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const TOKEN_TRANSPARENT_PROXY_ADDRESS = '0xbAa8E39DF4D8F4344a236541d9b270F28f0703aB';
const TOKEN_APPROVAL_ADDRESS = '0xD1560077A5466773b64c9a4a3835CB600363f29b';
const TOKEN_OWNER_ADDRESS = testMasterKeys.privateTestAccount1.address;
const APPROVAL_AMOUNT = Web3.utils.toWei('1000000000', 'ether');

module.exports = async function (callback) {
    try {
        const USDPUpgradeableInstance = await TokenUpgradeable.at(TOKEN_TRANSPARENT_PROXY_ADDRESS);
        await USDPUpgradeableInstance.approve(TOKEN_APPROVAL_ADDRESS, APPROVAL_AMOUNT, { from: TOKEN_OWNER_ADDRESS });
        console.log('Approval successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

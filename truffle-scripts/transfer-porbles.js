const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;

const PorbleUpgradeable = artifacts.require('PorbleUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PORBLE_TRANSPARENT_PROXY_ADDRESS = '0x52Ffde6ae9964F047C28174DeAc2b7Ad0d5360Ee';
const TOKEN_ID_TO_TRANSFER = '123';

module.exports = async function (callback) {
    try {
        const porbleUpgradeableInstance = await PorbleUpgradeable.at(PORBLE_TRANSPARENT_PROXY_ADDRESS);
        await porbleUpgradeableInstance.transferFrom(testAccountsData[1].address, testAccountsData[2].address, TOKEN_ID_TO_TRANSFER, { from: testAccountsData[1].address });
        console.log('Transfer successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

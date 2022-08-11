const testMasterKeys = require('../test-master-keys').testMasterKeys;

const ONFTUpgradeable = artifacts.require('PorbleONFTUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const ONFT_TRANSPARENT_PROXY_ADDRESS = '0xfd328c6074462fC7bb50f3543B0720cAc39e598F';
const TOKEN_ID = '2';

module.exports = async function (callback) {
    try {
        const ONFTUpgradeableInstance = await ONFTUpgradeable.at(ONFT_TRANSPARENT_PROXY_ADDRESS);
        const owner = await ONFTUpgradeableInstance.ownerOf(TOKEN_ID);
        console.log(`Owner: ${owner}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};

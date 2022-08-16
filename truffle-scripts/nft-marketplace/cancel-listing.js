const testMasterKeys = require('../../test-master-keys').testMasterKeys;

const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS = '0xD1560077A5466773b64c9a4a3835CB600363f29b';
const NFT_COLLECTION_ADDRESS = '0x2A957D1aD33d0106413968EDfe1efBDf14d1579c';
const TOKEN_OWNER_ADDRESS = testMasterKeys.privateTestAccount3.address;
const TOKEN_ID_TO_CANCEL = '1';

module.exports = async function (callback) {
    try {
        const NFTMarketplaceUpgradeableInstance = await NFTMarketplaceUpgradeable.at(NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS);
        await NFTMarketplaceUpgradeableInstance.cancelListing(NFT_COLLECTION_ADDRESS, TOKEN_ID_TO_CANCEL, { from: TOKEN_OWNER_ADDRESS });
        console.log('Listing cancelled');
    } catch (error) {
        console.log(error);
    }

    callback();
};

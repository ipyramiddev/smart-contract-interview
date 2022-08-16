const testMasterKeys = require('../../test-master-keys').testMasterKeys;

const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS = '0xD1560077A5466773b64c9a4a3835CB600363f29b';
const NFT_COLLECTION_ADDRESS = '0x2A957D1aD33d0106413968EDfe1efBDf14d1579c';
const TOKEN_OWNER_ADDRESS = testMasterKeys.privateTestAccount3.address;
const TOKEN_ID_TO_UPDATE = '1';
const NEW_LIST_PRICE = '200';

module.exports = async function (callback) {
    try {
        const NFTMarketplaceUpgradeableInstance = await NFTMarketplaceUpgradeable.at(NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS);
        await NFTMarketplaceUpgradeableInstance.updateListing(NFT_COLLECTION_ADDRESS, TOKEN_ID_TO_UPDATE, NEW_LIST_PRICE, { from: TOKEN_OWNER_ADDRESS });
        console.log('Listing updated');
    } catch (error) {
        console.log(error);
    }

    callback();
};

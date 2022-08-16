const testMasterKeys = require('../../test-master-keys').testMasterKeys;

const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS = '0xD1560077A5466773b64c9a4a3835CB600363f29b';
const NFT_COLLECTION_ADDRESS = '0x2A957D1aD33d0106413968EDfe1efBDf14d1579c';
const TOKEN_BUYER_ADDRESS = testMasterKeys.privateTestAccount1.address;
const TOKEN_ID_TO_BUY = '2';

// @NOTE: The TOKEN_BUYER_ADDRESS must have pre-approved the NFTMarketplace contract to transfer it's USDP (use the approve-erc20-token.js script)

module.exports = async function (callback) {
    try {
        const NFTMarketplaceUpgradeableInstance = await NFTMarketplaceUpgradeable.at(NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS);
        await NFTMarketplaceUpgradeableInstance.buyItem(NFT_COLLECTION_ADDRESS, TOKEN_ID_TO_BUY, { from: TOKEN_BUYER_ADDRESS });
        console.log('Item bought');
    } catch (error) {
        console.log(error);
    }

    callback();
};

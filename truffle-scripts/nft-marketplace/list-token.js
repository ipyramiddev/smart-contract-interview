const Web3 = require('web3');
const testMasterKeys = require('../../test-master-keys').testMasterKeys;
const NFT_MARKETPLACE_UPGRADEABLE_ABI = require('../../build/contracts/NFTMarketplaceUpgradeable.json').abi;
const config = require('../../config').config;
const getTxIdFromMultiSigWallet = require('../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');
const NFTUpgradeable = artifacts.require('PorbleONFTNativeUpgradeable');
const MultiSigWallet = artifacts.require('MultiSigWallet');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x9D4FC7884108d2377d0F23DD92AF601f7E326295';
const NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS = '0xD1560077A5466773b64c9a4a3835CB600363f29b';
const NFT_COLLECTION_ADDRESS = '0x2A957D1aD33d0106413968EDfe1efBDf14d1579c';
const TOKEN_OWNER_ADDRESS = testMasterKeys.privateTestAccount3.address;
const TOKEN_ID_TO_LIST = '3';
const LIST_PRICE = '100';

module.exports = async function (callback) {
    try {
        const NFTUpgradeableInstance = await NFTUpgradeable.at(NFT_COLLECTION_ADDRESS);
        const NFTMarketplaceUpgradeableInstance = await NFTMarketplaceUpgradeable.at(NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS);
        const NFTMarketplaceUpgradeableContract = new web3.eth.Contract(NFT_MARKETPLACE_UPGRADEABLE_ABI, NFT_MARKETPLACE_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);

        let data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(NFTUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        await NFTUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, TOKEN_ID_TO_LIST, { from: TOKEN_OWNER_ADDRESS });
        await NFTMarketplaceUpgradeableInstance.listItem(NFT_COLLECTION_ADDRESS, TOKEN_ID_TO_LIST, LIST_PRICE, { from: TOKEN_OWNER_ADDRESS });
        console.log('Item listed');
    } catch (error) {
        console.log(error);
    }

    callback();
};

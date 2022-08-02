const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;

const PorbleUpgradeable = artifacts.require('PorbleUpgradeable');

const PORBLE_TRANSPARENT_PROXY_ADDRESS = '0x52Ffde6ae9964F047C28174DeAc2b7Ad0d5360Ee';
const TOKEN_IDS_TO_MINT = ['130309781147598214138885601091864145081', '156258350440678697204504320501302781558'];
const SIGNATURE = '0x093f4a23705b72cb5d4a9bb918ed2c57964d936a5a6c3967250652e9e01f173563d50202c44c78615408475e2b52928da3210ddbe43d90f31891afe1f977dd681b';

module.exports = async function (callback) {
    try {
        const porbleUpgradeableInstance = await PorbleUpgradeable.at(PORBLE_TRANSPARENT_PROXY_ADDRESS);

        // The tokenId and tx sender must match those that have been signed for
        await porbleUpgradeableInstance.safeMintTokens(SIGNATURE, TOKEN_IDS_TO_MINT, { from: testAccountsData[2].address });

        console.log('Mint successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

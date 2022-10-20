const testMasterKeys = require('../../../test-master-keys').testMasterKeys;

// Just conveniently re-using a ERC20 contract artifacts for an already deployed contract
const USDC = artifacts.require('USDPUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const USDC_CONTRACT_OWNER = testMasterKeys.privateTestAccount1.address;
const USDC_ADDRESS = '0xAe564e9A99788fC65224c91D5A9Ea9F8d556c2D5';
const MINTED_TO = testMasterKeys.privateTestAccount2.address;

module.exports = async function (callback) {
    try {
        const USDCInstance = await USDC.at(USDC_ADDRESS);
        const initialUSDCAmountMinted = web3.utils.toWei('1000000000', 'ether');

        // Mint USDC
        await USDCInstance.mint(MINTED_TO, initialUSDCAmountMinted, { from: USDC_CONTRACT_OWNER });

        console.log('Mint successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

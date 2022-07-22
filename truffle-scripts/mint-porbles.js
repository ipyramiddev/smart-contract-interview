const ethers = require('ethers');
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;

const rpcEndpoint = config.AVAX.testnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const PorbleUpgradeable = artifacts.require('PorbleUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PORBLE_TRANSPARENT_PROXY_ADDRESS = '0x52Ffde6ae9964F047C28174DeAc2b7Ad0d5360Ee';
const TOKEN_IDS_TO_MINT = ['2', '3', '4', '5', '6', '7', '8', '9'];

module.exports = async function (callback) {
    try {
        const porbleUpgradeableInstance = await PorbleUpgradeable.at(PORBLE_TRANSPARENT_PROXY_ADDRESS);

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const tokenIds = TOKEN_IDS_TO_MINT;

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43113,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await porbleUpgradeableInstance.safeMintTokens(signature, tokenIds, { from: testAccountsData[1].address });

        console.log('Mint successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

const ethers = require('ethers');
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;

const rpcEndpoint = config.AVAX.testnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const PorbleUpgradeable = artifacts.require('PorbleUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PORBLE_TRANSPARENT_PROXY_ADDRESS = '0x52Ffde6ae9964F047C28174DeAc2b7Ad0d5360Ee';
const TOKEN_IDS_TO_SACRIFICE = ['8', '9'];

module.exports = async function (callback) {
    try {
        const porbleUpgradeableInstance = await PorbleUpgradeable.at(PORBLE_TRANSPARENT_PROXY_ADDRESS);

        // Now we want to sacrifice some of the tokens for the fusion
        const fusionTypes = {
            PorbleFusionConditions: [
                { name: 'owner', type: 'address' },
                { name: 'fusionId', type: 'uint256' },
                { name: 'sacrificialTokenIds', type: 'uint256[]' },
            ],
        };

        const fusionId = '7756';
        const sacrificialTokenIds = TOKEN_IDS_TO_SACRIFICE;
        const porbleFusionConditions = { owner: testAccountsData[1].address, fusionId, sacrificialTokenIds };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43113,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const fusionSignature = await signer._signTypedData(domain, fusionTypes, porbleFusionConditions);

        // Trigger the fusion
        await porbleUpgradeableInstance.fuse(fusionSignature, fusionId, sacrificialTokenIds, { from: testAccountsData[1].address });

        console.log('Fusion successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

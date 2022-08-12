const bigInt = require('big-integer');
const ethers = require('ethers');
const config = require('../config').config;
const testMasterKeys = require('../test-master-keys').testMasterKeys;
const USDP_UPGRADEABLE_ABI = require('../build/contracts/USDPUpgradeable.json').abi;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const rpcEndpoint = config.AVAX.testnetSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testMasterKeys.privateTestAccount2.privateKey, provider);

const MultiSigWallet = artifacts.require('MultiSigWallet');
const HeroUpgradeable = artifacts.require('ArchitectONFTNativeUpgradeable');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xAdef14f261cA04Afc5287940c96A2417F74aA197';
const USDP_TRANSPARENT_PROXY_ADDRESS = '0xC17930b021A2d0d9F175d4e13605fB53047cD31A';
const HERO_TRANSPARENT_PROXY_ADDRESS = '0x0144fF0f17d16EEAEA0E5a1C4dc07461Aa2401a5';
const TOKEN_IDS_TO_MINT = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TOKEN_PRICES = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

module.exports = async function (callback) {
    try {
        const USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDP_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const heroUpgradeableInstance = await HeroUpgradeable.at(HERO_TRANSPARENT_PROXY_ADDRESS);
        const USDPUpgradeableInstance = await USDPUpgradeable.at(USDP_TRANSPARENT_PROXY_ADDRESS);

        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = TOKEN_IDS_TO_MINT;
        const tokenPrices = TOKEN_PRICES;

        const heroMintConditions = { minter: testMasterKeys.privateTestAccount1.address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 808,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDP_TRANSPARENT_PROXY_ADDRESS, 0, data, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(testMasterKeys.privateTestAccount1.address, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDP_TRANSPARENT_PROXY_ADDRESS, 0, data, { from: testMasterKeys.privateTestAccount1.address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HERO_TRANSPARENT_PROXY_ADDRESS, USDPAmountToApprove, { from: testMasterKeys.privateTestAccount1.address });

        // The tokenId and tx sender must match those that have been signed for
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testMasterKeys.privateTestAccount1.address });

        console.log('Mint successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};

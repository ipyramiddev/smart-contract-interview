//@TODO: Need to make the MultiSigWallet contract the owner and execute the script with calls with MultiSigWallet

const ethers = require('ethers');
const Web3 = require('web3');
const PROXY_USDC_UPGRADEABLE_ABI = require('../../../build/contracts/ProxyOFTUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const ProxyUSDCUpgradeable = artifacts.require('ProxyOFTUpgradeable');
const USDC = artifacts.require('USDPUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const PROXY_USDC_CONTRACT_OWNER = testMasterKeys.privateTestAccount1.address;
const PROXY_USDC_TRANSPARENT_PROXY_ADDRESS = '0x2943f696c8614af76C37e281e102C7eC5C5F7EEE';
const USDC_ADDRESS = '0xAe564e9A99788fC65224c91D5A9Ea9F8d556c2D5';
const USDC_OWNER = testMasterKeys.privateTestAccount2.address;
const USDC_RECIPIENT = testMasterKeys.privateTestAccount3.address;
const USDC_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.0001', 'ether');
const DESTINATION_CHAIN_ID = '10128'; // PF-chain
const DESTINATION_ADDRESS = '0x083AE73152d48ad83F15A2Ca8ea9D7743261b780';

const DESTINATION_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [DESTINATION_ADDRESS]);
const adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 1200000]);

module.exports = async function (callback) {
    try {
        const ProxyUSDCUpgradeableInstance = await ProxyUSDCUpgradeable.at(PROXY_USDC_TRANSPARENT_PROXY_ADDRESS);
        const USDCInstance = await USDC.at(USDC_ADDRESS);

        const balanceOfHolder = (await USDCInstance.balanceOf(USDC_OWNER)).toString();
        console.log(`balanceOfHolder: ${balanceOfHolder}`);

        await ProxyUSDCUpgradeableInstance.setUseCustomAdapterParams(true, { from: PROXY_USDC_CONTRACT_OWNER });
        const useCustomAdapterParams = await ProxyUSDCUpgradeableInstance.useCustomAdapterParams();
        console.log(`useCustomAdapterParams: ${useCustomAdapterParams}`);

        await ProxyUSDCUpgradeableInstance.setMinDstGasLookup(DESTINATION_CHAIN_ID, 1, 200000, { from: PROXY_USDC_CONTRACT_OWNER });
        console.log(`minDstGasLookup set`);

        // await ProxyUSDCUpgradeableInstance.sendFrom();
    } catch (error) {
        console.log(error);
    }

    callback();
};

import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { TokenVaultExternalUpgradeableInstance, MultiSigWalletInstance, TokenVaultExternalUpgradeableTestInstance, USDPUpgradeableInstance } from '../../types/truffle-contracts';
import TOKEN_VAULT_UPGRADEABLE_JSON from '../../build/contracts/TokenVaultExternalUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const TokenVaultExternalUpgradeable = artifacts.require('TokenVaultExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const TokenVaultExternalUpgradeableTest = artifacts.require('TokenVaultExternalUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const TOKEN_VAULT_UPGRADEABLE_ABI = TOKEN_VAULT_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];
const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

contract.skip('TokenVaultExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let tokenVaultExternalUpgradeableInstance: TokenVaultExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let tokenVaultExternalUpgradeableTestInstance: TokenVaultExternalUpgradeableTestInstance;
    let TokenVaultExternalUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        tokenVaultExternalUpgradeableInstance = (await deployProxy(TokenVaultExternalUpgradeable as any, [], {
            initializer: 'initialize',
        })) as TokenVaultExternalUpgradeableInstance;
        await tokenVaultExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        TokenVaultExternalUpgradeableContract = new web3.eth.Contract(TOKEN_VAULT_UPGRADEABLE_ABI, tokenVaultExternalUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it('only allows the contract owner to withdraw PFT', async () => {
        const opId = '123';
        const amountToPay = '1000';

        await tokenVaultExternalUpgradeableInstance.sendTransaction({ from: account1, value: amountToPay });

        // This should be rejected as account0 is not the contract owner
        await localExpect(tokenVaultExternalUpgradeableInstance.withdrawAVAX(account8, amountToPay)).to.eventually.be.rejected;

        const accountBalanceOfPFTBefore = (await web3.eth.getBalance(account8)).toString();

        const data = TokenVaultExternalUpgradeableContract.methods.withdrawAVAX(account8, amountToPay).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const accountBalanceOfPFTAfter = (await web3.eth.getBalance(account8)).toString();
        expect(bigInt(accountBalanceOfPFTBefore).add('1000').toString()).to.equal(accountBalanceOfPFTAfter);
    });

    it('only allows the contract owner to withdraw ERC20 tokens', async () => {
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        await USDPUpgradeableInstance.addController(multiSigWalletInstance.address);
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        const amountToMint = '3000';
        let data = USDPUpgradeableContract.methods.mint(tokenVaultExternalUpgradeableInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // This should be rejected as account0 is not the contract owner
        await localExpect(tokenVaultExternalUpgradeableInstance.withdrawTokens(USDPUpgradeableInstance.address, account8, amountToMint)).to.eventually.be.rejected;

        const accountBalanceOfUSDPBefore = (await USDPUpgradeableInstance.balanceOf(account8)).toString();

        data = TokenVaultExternalUpgradeableContract.methods.withdrawTokens(USDPUpgradeableInstance.address, account8, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultExternalUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const accountBalanceOfUSDPAfter = (await USDPUpgradeableInstance.balanceOf(account8)).toString();
        expect(bigInt(accountBalanceOfUSDPBefore).add(amountToMint).toString()).to.equal(accountBalanceOfUSDPAfter);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let amountToPay = '1000';
        await tokenVaultExternalUpgradeableInstance.sendTransaction({ from: account1, value: amountToPay });

        let recipientBalanceBefore = (await web3.eth.getBalance(account3)).toString();
        let data = TokenVaultExternalUpgradeableContract.methods.withdrawAVAX(account3, amountToPay).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultExternalUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        let recipientBalanceAfter = (await web3.eth.getBalance(account3)).toString();

        expect(bigInt(recipientBalanceBefore).add(amountToPay).toString()).to.equal(recipientBalanceAfter);

        tokenVaultExternalUpgradeableTestInstance = (await upgradeProxy(
            tokenVaultExternalUpgradeableInstance.address,
            TokenVaultExternalUpgradeableTest as any
        )) as TokenVaultExternalUpgradeableTestInstance;

        amountToPay = '2000';

        // withdrawAVAX function has been removed from the upgrade contract, so need to test that a call to this silently reverts
        recipientBalanceBefore = (await web3.eth.getBalance(account3)).toString();
        data = TokenVaultExternalUpgradeableContract.methods.withdrawAVAX(account3, amountToPay).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        recipientBalanceAfter = (await web3.eth.getBalance(account3)).toString();

        expect(recipientBalanceBefore).to.equal(recipientBalanceAfter);
    });
});

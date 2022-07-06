import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { TokenVaultUpgradeableInstance, MultiSigWalletInstance, TokenVaultUpgradeableTestInstance, USDPUpgradeableInstance } from '../../types/truffle-contracts';
import TOKEN_VAULT_UPGRADEABLE_JSON from '../../build/contracts/TokenVaultUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const TokenVaultUpgradeable = artifacts.require('TokenVaultUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const TokenVaultUpgradeableTest = artifacts.require('TokenVaultUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const TOKEN_VAULT_UPGRADEABLE_ABI = TOKEN_VAULT_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];
const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

contract.skip('TokenVaultUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let tokenVaultUpgradeableInstance: TokenVaultUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let tokenVaultUpgradeableTestInstance: TokenVaultUpgradeableTestInstance;
    let TokenVaultUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        tokenVaultUpgradeableInstance = (await deployProxy(TokenVaultUpgradeable as any, [account1], {
            initializer: 'initialize',
        })) as TokenVaultUpgradeableInstance;
        await tokenVaultUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        TokenVaultUpgradeableContract = new web3.eth.Contract(TOKEN_VAULT_UPGRADEABLE_ABI, tokenVaultUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it('allows a user to pay for a specific opId', async () => {
        const opId = '123';
        const amountToPay = '1000';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.fulfilled;
        const amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        expect(amountPaid).to.equal(amountToPay);
    });

    it('reverts if the user tries to call the pay function without sending any PFT', async () => {
        const opId = '123';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2 })).to.eventually.be.rejected;
    });

    it('only allows an opId to be paid for once', async () => {
        const opId = '123';
        const amountToPay = '1000';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.fulfilled;
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.rejected;
    });

    it('allows only the contract owner to refund a user', async () => {
        const opId = '123';
        const amountToPay = '1000';
        const balanceOfPFTVaultBeforePayment = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.fulfilled;
        let amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        expect(amountPaid).to.equal(amountToPay);
        const balanceOfPFTVaultAfterPayment = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        expect(balanceOfPFTVaultAfterPayment).to.equal(bigInt(balanceOfPFTVaultBeforePayment).add(amountToPay).toString());

        // Expect a non-owner call to the issueFullRefund function to revert
        await localExpect(tokenVaultUpgradeableInstance.issueFullRefund(account2, opId)).to.eventually.be.rejected;

        // Refund issued by the owner
        let data = TokenVaultUpgradeableContract.methods.issueFullRefund(account2, opId).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        expect(amountPaid).to.equal('0');
        const balanceOfPFTVaultAfterRefund = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        expect(balanceOfPFTVaultAfterRefund).to.equal(balanceOfPFTVaultBeforePayment);
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await tokenVaultUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(tokenVaultUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = TokenVaultUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await tokenVaultUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(tokenVaultUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = TokenVaultUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await tokenVaultUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it("doesn't allows a user to pay for an opId when the contract is paused", async () => {
        let data = TokenVaultUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const opId = '123';
        const amountToPay = '1000';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.rejected;
    });

    it('only allows the contract owner to withdraw PFT', async () => {
        const opId = '123';
        const amountToPay = '1000';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.fulfilled;

        // This should be rejected as account0 is not the contract owner
        await localExpect(tokenVaultUpgradeableInstance.withdrawPFT(account8, amountToPay)).to.eventually.be.rejected;

        const accountBalanceOfPFTBefore = (await web3.eth.getBalance(account8)).toString();

        const data = TokenVaultUpgradeableContract.methods.withdrawPFT(account8, amountToPay).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
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
        let data = USDPUpgradeableContract.methods.mint(tokenVaultUpgradeableInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // This should be rejected as account0 is not the contract owner
        await localExpect(tokenVaultUpgradeableInstance.withdrawTokens(USDPUpgradeableInstance.address, account8, amountToMint)).to.eventually.be.rejected;

        const accountBalanceOfUSDPBefore = (await USDPUpgradeableInstance.balanceOf(account8)).toString();

        data = TokenVaultUpgradeableContract.methods.withdrawTokens(USDPUpgradeableInstance.address, account8, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const accountBalanceOfUSDPAfter = (await USDPUpgradeableInstance.balanceOf(account8)).toString();
        expect(bigInt(accountBalanceOfUSDPBefore).add(amountToMint).toString()).to.equal(accountBalanceOfUSDPAfter);
    });

    it('allows PFT to be transferred from the vault if the signature is successfully verified', async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceBefore = (await web3.eth.getBalance(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceAfter = (await web3.eth.getBalance(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).greater(recipientBalanceBefore)).to.be.true;
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // The second call to transferFromVault with the same signature should fail
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('allows tokens to be claimed multiple times when the claimId is incremented correctly', async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceBefore = (await web3.eth.getBalance(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Increment the claimId
        PFTVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '1' };
        signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceAfter = (await web3.eth.getBalance(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1').multiply('2')).toString());
        expect(bigInt(recipientBalanceAfter).greater(recipientBalanceBefore)).to.be.true;
    });

    it('reverts when the claimId is incremented incorrectly', async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Increment the claimId
        PFTVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '100' };
        signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the 'PFTVaultTransferConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PFTVaultTransferConditionsWrong: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '5',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the signed 'recipient' address doesn't match the sender address of the tx", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents PFT from being transferred if the signed `amount` doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, web3.utils.toWei('0.5', 'ether'), { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it('prevents PFT from being transferred if the signature is tampered with', async () => {
        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: account1, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(tamperedSignature, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the PFTVaultTransferSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(tokenVaultUpgradeableInstance.setPFTVaultTransferSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = TokenVaultUpgradeableContract.methods.setPFTVaultTransferSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPFTVaultTransferSigner = await tokenVaultUpgradeableInstance.PFTVaultTransferSigner();
        expect(contractPFTVaultTransferSigner).to.equal(account3);
    });

    it("only allows PFT to be transferred if the signer is updated to match the contract's changed PFTVaultTransferSigner", async () => {
        // Change the mint signer
        let data = TokenVaultUpgradeableContract.methods.setPFTVaultTransferSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PFTVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // This should fail because the _PFTVaultTransferSigner has changed and no longer matches the signer
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newSignature = await newSigner._signTypedData(domain, types, PFTVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceBefore = (await web3.eth.getBalance(account1)).toString();

        // Should now pass because the signer has been updated
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(newSignature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceAfter = (await web3.eth.getBalance(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).greater(recipientBalanceBefore)).to.be.true;
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const opId = '123';
        const amountToPay = '1000';
        await localExpect(tokenVaultUpgradeableInstance.payForOpId(opId, { from: account2, value: amountToPay })).to.eventually.be.fulfilled;
        let amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        expect(amountPaid).to.equal(amountToPay);

        const types = {
            PFTVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PFTVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: tokenVaultUpgradeableInstance.address,
        };

        const amountToSendToVault = web3.utils.toWei('100', 'ether');
        await tokenVaultUpgradeableInstance.sendTransaction({ from: account9, value: amountToSendToVault });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PFTVaultTransferConditions);

        // Keep track of balances before the transfer
        let vaultBalanceBefore = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceBefore = (await web3.eth.getBalance(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        let vaultBalanceAfter = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipientBalanceAfter = (await web3.eth.getBalance(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).greater(recipientBalanceBefore)).to.be.true;

        tokenVaultUpgradeableTestInstance = (await upgradeProxy(tokenVaultUpgradeableInstance.address, TokenVaultUpgradeableTest as any)) as TokenVaultUpgradeableTestInstance;

        // Retest the initial payment after upgrade. Should be the same.
        amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        expect(amountPaid).to.equal(amountToPay);

        // Retest vault transfer after upgrading contract. Should work fine
        const PFTVaultTransferConditions2 = { recipient: testAccountsData[2].address, amount: amountToTransfer, claimId: '0' };
        const signature2 = await signer._signTypedData(domain, types, PFTVaultTransferConditions2);
        vaultBalanceBefore = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipient2BalanceBefore = (await web3.eth.getBalance(account2)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(tokenVaultUpgradeableInstance.transferFromVault(signature2, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.fulfilled;

        vaultBalanceAfter = (await web3.eth.getBalance(tokenVaultUpgradeableInstance.address)).toString();
        const recipient2BalanceAfter = (await web3.eth.getBalance(account2)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipient2BalanceAfter).greater(recipient2BalanceBefore)).to.be.true;

        // issueFullRefund function has been removed from the upgrade contract, so need to test that a call to this reverts
        let data = TokenVaultUpgradeableContract.methods.issueFullRefund(account2, opId).encodeABI();
        await multiSigWalletInstance.submitTransaction(tokenVaultUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        amountPaid = (await tokenVaultUpgradeableInstance.getUserPaymentAmountForOpId(account2, opId)).toString();
        // That refund should have failed silently (since we're calling it with MultiSigWallet)
        // If it has failed then the payments information should still hold the initial payment
        expect(amountPaid).to.equal(amountToPay);
    });
});

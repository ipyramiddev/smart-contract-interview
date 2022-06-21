import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { MultiSigWalletInstance, PORBUpgradeableInstance, PORBUpgradeableTestInstance } from '../../types/truffle-contracts';
import PORB_UPGRADEABLE_JSON from '../../build/contracts/PORBUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const PORBUpgradeable = artifacts.require('PORBUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const PORBUpgradeableTest = artifacts.require('PORBUpgradeableTest');

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);
const PORB_UPGRADEABLE_ABI = PORB_UPGRADEABLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

contract.skip('PORBUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PORBUpgradeableInstance: PORBUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PORBUpgradeableTestInstance: PORBUpgradeableTestInstance;
    let PORBUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, multiSigWalletInstance.address], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        PORBUpgradeableContract = new web3.eth.Contract(PORB_UPGRADEABLE_ABI, PORBUpgradeableInstance.address);
        const data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it("has token name set to 'Portal Fantasy Orb'", async () => {
        const tokenName = await PORBUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Orb');
    });

    it("has token symbol set to 'PORB'", async () => {
        const tokenSymbol = await PORBUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PORB');
    });

    it('has 18 token decimals', async () => {
        const decimals = (await PORBUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await PORBUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = PORBUpgradeableContract.methods.addController(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PORBUpgradeableInstance as any).controllers.call(account3);
        expect(isController).to.be.true;
    });

    it('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = PORBUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PORBUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-PORB-contract-owner account to add a controller", async () => {
        await localExpect(PORBUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-PORB-contract-owner account to remove a controller", async () => {
        await localExpect(PORBUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await PORBUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PORBUpgradeableInstance.balanceOf(account2)).toString();

        const data = PORBUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await PORBUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = PORBUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await PORBUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-PORB-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(PORBUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it("doesn't allow a non-PORB-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = PORBUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(PORBUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it('allows PORB to be transferred from the vault if the signature is successfully verified', async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceBefore = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceAfter = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(amountToTransfer);
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('allows tokens to be claimed multiple times when the claimId is incremented correctly', async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceBefore = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Increment the claimId
        PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '1' };
        signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceAfter = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1').multiply('2')).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply('2').toString());
    });

    it('reverts when the claimId is incremented incorrectly', async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Increment the claimId
        PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '100' };
        signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the 'PORBVaultTransferConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PORBVaultTransferConditionsWrong: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '5',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the signed 'recipient' address doesn't match the sender address of the tx", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the signed `amount` doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, web3.utils.toWei('101', 'ether'), { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents PORB from being transferred if the signature is tampered with', async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        const data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(tamperedSignature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the PORBVaultTransferSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(PORBUpgradeableInstance.setPORBVaultTransferSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = PORBUpgradeableContract.methods.setPORBVaultTransferSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVaultTransferSigner = await PORBUpgradeableInstance.PORBVaultTransferSigner();
        expect(contractPORBVaultTransferSigner).to.equal(account3);
    });

    it("only allows PORB to be transferred if the signer is updated to match the contract's changed PORBVaultTransferSigner", async () => {
        // Change the mint signer
        let data = PORBUpgradeableContract.methods.setPORBVaultTransferSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // This should fail because the _PORBVaultTransferSigner has changed and no longer matches the signer
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceBefore = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        // Should now pass because the signer has been updated
        await localExpect(PORBUpgradeableInstance.transferFromVault(newsignature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceAfter = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(amountToTransfer);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await PORBUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PORB');

        const types = {
            PORBVaultTransferConditions: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'claimId', type: 'uint256' },
            ],
        };

        const amountToTransfer = web3.utils.toWei('1', 'ether');

        let PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer, claimId: '0' };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PORBUpgradeableInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei('100', 'ether');

        let data = PORBUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        let vaultBalanceBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceBefore = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        let vaultBalanceAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipientBalanceAfter = (await PORBUpgradeableInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(amountToTransfer);

        PORBUpgradeableTestInstance = (await upgradeProxy(PORBUpgradeableInstance.address, PORBUpgradeableTest as any)) as PORBUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await PORBUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PORB');

        // Retest vault transfer after upgrading contract. Should work fine
        const PORBVaultTransferConditions2 = { recipient: testAccountsData[2].address, amount: amountToTransfer, claimId: '0' };
        const signature2 = await signer._signTypedData(domain, types, PORBVaultTransferConditions2);
        vaultBalanceBefore = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipient2BalanceBefore = (await PORBUpgradeableInstance.balanceOf(account2)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBUpgradeableInstance.transferFromVault(signature2, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.fulfilled;

        vaultBalanceAfter = (await PORBUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();
        const recipient2BalanceAfter = (await PORBUpgradeableInstance.balanceOf(account2)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt('-1')).toString());
        expect(bigInt(recipient2BalanceAfter).subtract(recipient2BalanceBefore).toString()).to.equal(amountToTransfer);

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = PORBUpgradeableContract.methods.mint(account2, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(amountToMintToVault);
    });
});

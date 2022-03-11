import { localExpect, bigInt } from "./lib/test-libraries";
import { PFTInstance, MultiSigWalletInstance } from "../types/truffle-contracts";
import PFT_JSON from "../build/contracts/PFT.json";
import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { getTxIdFromMultiSigWallet } from "./lib/test-helpers";

const config = require("../config").config;

const PFT = artifacts.require("PFT");
const multiSigWallet = artifacts.require("MultiSigWallet");

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const PFT_ABI = PFT_JSON.abi as AbiItem[];

contract.skip("PFT.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PFTInstance: PFTInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PFTContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PFTInstance = await PFT.new();
        await PFTInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        PFTContract = new web3.eth.Contract(PFT_ABI, PFTInstance.address);
        const data = PFTContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await PFTInstance.name();
        expect(tokenName).to.equal("Portal Fantasy Token");
    });

    it("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await PFTInstance.symbol();
        expect(tokenSymbol).to.equal("PFT");
    });

    it("has 18 token decimals", async () => {
        const decimals = (await PFTInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the multiSigWallet address", async () => {
        const contractOwner = await PFTInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it("allows the contract owner (multiSigWallet) to add another controller", async () => {
        const data = PFTContract.methods.addController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PFTInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner (multiSigWallet) to remove a controller", async () => {
        const data = PFTContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PFTInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-PFT-contract-owner account to add a controller", async () => {
        await localExpect(PFTInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-PFT-contract-owner account to remove a controller", async () => {
        await localExpect(PFTInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await PFTInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PFTInstance.balanceOf(account2)).toString();

        const data = PFTContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PFTInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account (multiSigWallet) to burn tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await PFTInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PFTInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = PFTContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = PFTContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await PFTInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-PFT-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(PFTInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-PFT-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        let data = PFTContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(PFTInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });
});

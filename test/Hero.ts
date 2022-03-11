import { localExpect } from "./lib/test-libraries";
import { HeroInstance, PORBInstance, MultiSigWalletInstance } from "../types/truffle-contracts";
import HERO_JSON from "../build/contracts/Hero.json";
import PORB_JSON from "../build/contracts/PORB.json";
import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { getTxIdFromMultiSigWallet } from "./lib/test-helpers";

const config = require("../config").config;

const hero = artifacts.require("Hero");
const PORB = artifacts.require("PORB");
const multiSigWallet = artifacts.require("MultiSigWallet");

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const HERO_ABI = HERO_JSON.abi as AbiItem[];
const PORB_ABI = PORB_JSON.abi as AbiItem[];

contract.skip("Hero.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let heroInstance: HeroInstance;
    let PORBInstance: PORBInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let heroContract: any;
    let PORBContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBInstance = await PORB.new(account1, owner);
        heroInstance = await hero.new(PORBInstance.address, account9);
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);
        await heroInstance.transferOwnership(multiSigWalletInstance.address);

        heroContract = new web3.eth.Contract(HERO_ABI, heroInstance.address);
        PORBContract = new web3.eth.Contract(PORB_ABI, PORBInstance.address);
    });

    it("has token name set to 'Portal Fantasy Hero'", async () => {
        const tokenName = await heroInstance.name();
        expect(tokenName).to.equal("Portal Fantasy Hero");
    });

    it("has token symbol set to 'PHRO'", async () => {
        const tokenSymbol = await heroInstance.symbol();
        expect(tokenSymbol).to.equal("PHRO");
    });

    it("can only be paused/unpaused by the owner (multiSigWallet)", async () => {
        let isPaused = await heroInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(heroInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = heroContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await heroInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(heroInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = heroContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await heroInstance.paused();
        expect(isPaused).to.be.false;
    });

    it("allows a Hero NFT to be minted with payment in PORB", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedHero = await heroInstance.ownerOf("0");
        const balanceOfPORBVault = (await PORBInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedHero).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfHeroInPORB);
    });

    it("only allows the owner (multiSigWallet) to change mintPriceInPORB", async () => {
        const newMintPriceInPORB = web3.utils.toWei("5", "ether");

        // Should fail since caller is not the owner
        await localExpect(heroInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = heroContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await heroInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it("only allows the owner (multiSigWallet) to change the PORB contract address", async () => {
        const newPORBInstance = await PORB.new(account1, owner);

        // Should fail since caller is not the owner
        await localExpect(heroInstance.setPORB(newPORBInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = heroContract.methods.setPORB(newPORBInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await heroInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBInstance.address);
    });

    it("only allows the owner (multiSigWallet) to change the PORB vault", async () => {
        // Should fail since caller is not the owner
        await localExpect(heroInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = heroContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await heroInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it("generates a valid token URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });

        const tokenURI = await heroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");
    });

    it("allows only the owner (multiSigWallet) to change the base URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });

        let tokenURI = await heroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroInstance.setBaseURIString("https://www.foo.com/", { from: account1 })).to.eventually.be.rejected;

        data = heroContract.methods.setBaseURIString("https://www.bar.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await heroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.bar.com/0");
    });
});

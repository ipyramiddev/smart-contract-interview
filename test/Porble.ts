import { localExpect } from "./lib/test-libraries";
import { PorbleInstance } from "../types/truffle-contracts";

const ethers = require("ethers");
const testAccountsData = require("../test/data/test-accounts-data").testAccountsData;
const config = require("../config").config;

const Porble = artifacts.require("Porble");

const rpcEndpoint = config.AVAX.localHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

contract.skip("Porble.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let porbleInstance: PorbleInstance;

    beforeEach(async () => {
        porbleInstance = await Porble.new(account1);
    });

    it("has token name set to 'Porble'", async () => {
        const tokenName = await porbleInstance.name();
        expect(tokenName).to.equal("Porble");
    });

    it("has token symbol set to 'PRBL'", async () => {
        const tokenSymbol = await porbleInstance.symbol();
        expect(tokenSymbol).to.equal("PRBL");
    });

    it("has the contract owner set to the deployer address", async () => {
        const contractOwner = await porbleInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("can only be paused/unpaused by the owner", async () => {
        let isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(porbleInstance.setPaused(true, { from: account1 })).to.be.rejected;

        await porbleInstance.setPaused(true);

        isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(porbleInstance.setPaused(false, { from: account1 })).to.be.rejected;

        await porbleInstance.setPaused(false);

        isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.false;
    });

    it("allows a porble token to be minted if the signature is successfully verified", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    it("prevents a porble token from being minted if the 'PorbleMintConditions' key is doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PorbleMintConditionsWrong: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasyWrong",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "9",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 99999,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: "0xcccccccccccccccccccccccccccccccccccccccc",
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 99999, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signature is tampered with", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        const signatureArr = signature.split("");
        signatureArr[10] = "7";
        const tamperedSignature = signatureArr.join("");

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(tamperedSignature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("only allows the owner to change the _mintSigner", async () => {
        // Should fail since caller is not the owner
        await localExpect(porbleInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        await localExpect(porbleInstance.setMintSigner(account3, { from: owner })).to.eventually.be.fulfilled;
    });

    it("only allows a token to be minted if the signer is updated to match the contract's changed _mintSigner", async () => {
        // Change the mint signer
        await porbleInstance.setMintSigner(account2, { from: owner });

        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // This should fail because the _mintSigner has changed and no longer matches the signer
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, porbleMintConditions);

        await localExpect(porbleInstance.safeMint(newsignature, 2, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it("generates a valid token URI", async () => {
        const types = {
            PorbleMintConditions: [
                { name: "minter", type: "address" },
                { name: "tokenId", type: "uint256" },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        await porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address });

        const tokenURI = await porbleInstance.tokenURI("1");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/1");
    });
});

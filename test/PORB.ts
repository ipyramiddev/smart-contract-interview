import { localExpect, bigInt } from "./lib/test-libraries";
import { PORBInstance } from "../types/truffle-contracts";

const ethers = require("ethers");
const testAccountsData = require("../test/data/test-accounts-data").testAccountsData;
const config = require("../config").config;

const PORB = artifacts.require("PORB");

const rpcEndpoint = config.AVAX.localHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

contract.skip("PORB.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PORBInstance: PORBInstance;

    beforeEach(async () => {
        PORBInstance = await PORB.new(account1, owner);
    });

    it("has token name set to 'PORB'", async () => {
        const tokenName = await PORBInstance.name();
        expect(tokenName).to.equal("PORB");
    });

    it("has token symbol set to 'PORB'", async () => {
        const tokenSymbol = await PORBInstance.symbol();
        expect(tokenSymbol).to.equal("PORB");
    });

    it("has 18 token decimals", async () => {
        const decimals = (await PORBInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the deployer address", async () => {
        const contractOwner = await PORBInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("sets the owner as a controller on construction", async () => {
        const isController = await (PORBInstance as any).controllers.call(owner);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to add a controller", async () => {
        await localExpect(PORBInstance.addController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PORBInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to remove a controller", async () => {
        await localExpect(PORBInstance.removeController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PORBInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-owner account to add a controller", async () => {
        await localExpect(PORBInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-owner account to remove a controller", async () => {
        await localExpect(PORBInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account to mint tokens", async () => {
        await PORBInstance.addController(account2, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await PORBInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PORBInstance.balanceOf(account2)).toString();

        await localExpect(PORBInstance.mint(account2, amountToMint, { from: account2 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account to burn tokens", async () => {
        await PORBInstance.addController(account3, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await PORBInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PORBInstance.balanceOf(account3)).toString();

        await PORBInstance.mint(account3, amountToMint, { from: account3 });
        await localExpect(PORBInstance.burn(account3, amountToBurn, { from: account3 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBInstance.balanceOf(account3)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(PORBInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-controller account to burn tokens", async () => {
        await PORBInstance.addController(account4, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        await PORBInstance.mint(account5, amountToMint, { from: account4 });

        await localExpect(PORBInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it("allows PORB to be transferred from the vault if the signature is successfully verified", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await PORBInstance.balanceOf(owner)).toString();
        const recipientBalanceBefore = (await PORBInstance.balanceOf(account1)).toString();

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await PORBInstance.balanceOf(owner)).toString();
        const recipientBalanceAfter = (await PORBInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt("-1")).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(amountToTransfer);
    });

    it("prevents PORB from being transferred if the 'PORBVaultTransferConditions' key is doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PORBVaultTransferConditionsWrong: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasyWrong",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "5",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 99999,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: "0xcccccccccccccccccccccccccccccccccccccccc",
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the signed 'recipient' address doesn't match the sender address of the tx", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the signed `amount` doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(signature, web3.utils.toWei("101", "ether"), { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents PORB from being transferred if the signature is tampered with", async () => {
        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        const signatureArr = signature.split("");
        signatureArr[10] = "7";
        const tamperedSignature = signatureArr.join("");

        // The amount and tx sender must match those that have been signed for
        await localExpect(PORBInstance.transferFromVault(tamperedSignature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("only allows the owner to change the _PORBVaultTransferSigner", async () => {
        // Should fail since caller is not the owner
        await localExpect(PORBInstance.setPORBVaultTransferSigner(account3, { from: account1 })).to.eventually.be.rejected;

        await localExpect(PORBInstance.setPORBVaultTransferSigner(account3, { from: owner })).to.eventually.be.fulfilled;
    });

    it("only allows PORB to be transferred if the signer is updated to match the contract's changed _PORBVaultTransferSigner", async () => {
        // Change the mint signer
        await PORBInstance.setPORBVaultTransferSigner(account2, { from: owner });

        const types = {
            PORBVaultTransferConditions: [
                { name: "recipient", type: "address" },
                { name: "amount", type: "uint256" },
            ],
        };

        const amountToTransfer = web3.utils.toWei("1", "ether");

        const PORBVaultTransferConditions = { recipient: testAccountsData[1].address, amount: amountToTransfer };

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PORBInstance.address,
        };

        const amountToMintToVault = web3.utils.toWei("100", "ether");

        await PORBInstance.mint(owner, amountToMintToVault);

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, PORBVaultTransferConditions);

        // This should fail because the _PORBVaultTransferSigner has changed and no longer matches the signer
        await localExpect(PORBInstance.transferFromVault(signature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, PORBVaultTransferConditions);

        // Keep track of balances before the transfer
        const vaultBalanceBefore = (await PORBInstance.balanceOf(owner)).toString();
        const recipientBalanceBefore = (await PORBInstance.balanceOf(account1)).toString();

        // Should now pass because the signer has been updated
        await localExpect(PORBInstance.transferFromVault(newsignature, amountToTransfer, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        const vaultBalanceAfter = (await PORBInstance.balanceOf(owner)).toString();
        const recipientBalanceAfter = (await PORBInstance.balanceOf(account1)).toString();

        expect(bigInt(vaultBalanceAfter).subtract(vaultBalanceBefore).toString()).to.equal(bigInt(amountToTransfer).multiply(bigInt("-1")).toString());
        expect(bigInt(recipientBalanceAfter).subtract(recipientBalanceBefore).toString()).to.equal(amountToTransfer);
    });
});

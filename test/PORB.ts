import { localExpect, bigInt } from "./test-libraries";

const PORB = artifacts.require("PORB");

contract("PORB.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    it("has token name set to 'PORB'", async () => {
        const porbInstance = await PORB.deployed();

        const tokenName = await porbInstance.name();
        expect(tokenName).to.equal("PORB");
    });

    it("has token symbol set to 'PORB'", async () => {
        const porbInstance = await PORB.deployed();

        const tokenSymbol = await porbInstance.symbol();
        expect(tokenSymbol).to.equal("PORB");
    });

    it("has 18 token decimals", async () => {
        const porbInstance = await PORB.deployed();

        const decimals = (await porbInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the deployer address", async () => {
        const porbInstance = await PORB.deployed();

        const contractOwner = await porbInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("allows the contract owner to add a controller", async () => {
        const porbInstance = await PORB.deployed();

        await localExpect(porbInstance.addController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (porbInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to remove a controller", async () => {
        const porbInstance = await PORB.deployed();

        await localExpect(porbInstance.removeController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (porbInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-owner account to add a controller", async () => {
        const porbInstance = await PORB.deployed();

        await localExpect(porbInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-owner account to remove a controller", async () => {
        const porbInstance = await PORB.deployed();

        await localExpect(porbInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account to mint tokens", async () => {
        const porbInstance = await PORB.deployed();

        await porbInstance.addController(account2, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await porbInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await porbInstance.balanceOf(account2)).toString();

        await localExpect(porbInstance.mint(account2, amountToMint, { from: account2 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await porbInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await porbInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account to burn tokens", async () => {
        const porbInstance = await PORB.deployed();

        await porbInstance.addController(account3, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await porbInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await porbInstance.balanceOf(account3)).toString();

        await porbInstance.mint(account3, amountToMint, { from: account3 });
        await localExpect(porbInstance.burn(account3, amountToBurn, { from: account3 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await porbInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await porbInstance.balanceOf(account3)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-controller account to mint tokens", async () => {
        const porbInstance = await PORB.deployed();

        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(porbInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await porbInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-controller account to burn tokens", async () => {
        const porbInstance = await PORB.deployed();

        await porbInstance.addController(account4, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        await porbInstance.mint(account5, amountToMint, { from: account4 });

        await localExpect(porbInstance.burn(account5, amountToBurn), { from: account5 }).to.eventually.be.rejected;

        const balanceOfAccount = (await porbInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });
});

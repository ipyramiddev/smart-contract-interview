import { localExpect, bigInt } from "./test-libraries";

const PFT = artifacts.require("PFT");

contract("PFT.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    it("has token name set to 'PFT'", async () => {
        const pftInstance = await PFT.deployed();

        const tokenName = await pftInstance.name();
        expect(tokenName).to.equal("PFT");
    });

    it("has token symbol set to 'PFT'", async () => {
        const pftInstance = await PFT.deployed();

        const tokenSymbol = await pftInstance.symbol();
        expect(tokenSymbol).to.equal("PFT");
    });

    it("has 18 token decimals", async () => {
        const pftInstance = await PFT.deployed();

        const decimals = (await pftInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the deployer address", async () => {
        const pftInstance = await PFT.deployed();

        const contractOwner = await pftInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("allows the contract owner to add a controller", async () => {
        const pftInstance = await PFT.deployed();

        await localExpect(pftInstance.addController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (pftInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to remove a controller", async () => {
        const pftInstance = await PFT.deployed();

        await localExpect(pftInstance.removeController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (pftInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-owner account to add a controller", async () => {
        const pftInstance = await PFT.deployed();

        await localExpect(pftInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-owner account to remove a controller", async () => {
        const pftInstance = await PFT.deployed();

        await localExpect(pftInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account to mint tokens", async () => {
        const pftInstance = await PFT.deployed();

        await pftInstance.addController(account2, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await pftInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await pftInstance.balanceOf(account2)).toString();

        await localExpect(pftInstance.mint(account2, amountToMint, { from: account2 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await pftInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await pftInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account to burn tokens", async () => {
        const pftInstance = await PFT.deployed();

        await pftInstance.addController(account3, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = (await pftInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await pftInstance.balanceOf(account3)).toString();

        await pftInstance.mint(account3, amountToMint, { from: account3 });
        await localExpect(pftInstance.burn(account3, amountToBurn, { from: account3 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await pftInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await pftInstance.balanceOf(account3)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-controller account to mint tokens", async () => {
        const pftInstance = await PFT.deployed();

        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(pftInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await pftInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-controller account to burn tokens", async () => {
        const pftInstance = await PFT.deployed();

        await pftInstance.addController(account4, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        await pftInstance.mint(account5, amountToMint, { from: account4 });

        await localExpect(pftInstance.burn(account5, amountToBurn), { from: account5 }).to.eventually.be.rejected;

        const balanceOfAccount = (await pftInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });
});

const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PFT_TRANSPARENT_PROXY_ADDRESS = '0x14d90CfF69af99ECF4f4e706Cd077753BE7789F6';
const ACCOUNT_ADDRESS = '0x083AE73152d48ad83F15A2Ca8ea9D7743261b780';

module.exports = async function (callback) {
    try {
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);
        const balance = (await PFTUpgradeableInstance.balanceOf(ACCOUNT_ADDRESS)).toString();
        console.log(`WPFT balance: ${balance}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};

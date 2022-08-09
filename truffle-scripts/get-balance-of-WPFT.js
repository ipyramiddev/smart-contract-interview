const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');

// Copy these over from .env file because it's safer to do it manually
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xa0565592ADF32FC09f17737c3Bf931Fa5cD8A741';
const ACCOUNT_ADDRESS = '0xA8cb1ABd5107432B99F41Db24922BD3D2F5CFC2E';

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

// Need to import Chai library explicitly because, annoyingly, Truffle-injected Chai instance cannot be configured
// Only use the local Chai instance when asserting on promises
const localChai = require('chai');
localChai.use(require('chai-as-promised'));
localChai.use(require('chai-bignumber')());
export const localExpect = localChai.expect;

export const bigInt = require('big-integer');

export const addMonths = require('date-fns/addMonths');
export const differenceInDays = require('date-fns/differenceInDays');
export const differenceInSeconds = require('date-fns/differenceInSeconds');

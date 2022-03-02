type VestingCategory = "SEED" | "PRIVATE_SALE" | "PARTNERSHIPS" | "ADVISORS" | "TEAM";
type CategoryVestingParameters = { cliffInMonths: number; vestingDurationInMonths: number; totalAllocation: number };
type RecipientVestingInfo = { category: VestingCategory; allocation: number };

export const categoryToVestingParameters = new Map<VestingCategory, CategoryVestingParameters>([
    ["SEED", { cliffInMonths: 6, vestingDurationInMonths: 12, totalAllocation: 30000000 }],
    ["PRIVATE_SALE", { cliffInMonths: 6, vestingDurationInMonths: 12, totalAllocation: 130000000 }],
    ["PARTNERSHIPS", { cliffInMonths: 6, vestingDurationInMonths: 12, totalAllocation: 80000000 }],
    ["ADVISORS", { cliffInMonths: 6, vestingDurationInMonths: 18, totalAllocation: 30000000 }],
    ["TEAM", { cliffInMonths: 6, vestingDurationInMonths: 18, totalAllocation: 170000000 }],
]);

export const globalTokenGrants = new Map<string, RecipientVestingInfo>([
    // Seed
    ["0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9", { category: "SEED", allocation: 3000000 }],
    ["0x769fd6cc56e084119dd7669ddb9a9f37d5827db2", { category: "SEED", allocation: 3000000 }],
    // Private sale
    ["0xb7a61e70d2c5c53bf5787f208d91ff89d886e68c", { category: "PRIVATE_SALE", allocation: 3000000 }],
    ["0xbc109315617bf4d0bddabe29f5315355f08544cd", { category: "PRIVATE_SALE", allocation: 3000000 }],
    // Partnerships
    ["0xb2ea8a1467db745b18800c812414438e4a31f8bb", { category: "PARTNERSHIPS", allocation: 3000000 }],
    ["0x41929c5438d898a62c8eb126f4ce5150348b72f5", { category: "PARTNERSHIPS", allocation: 3000000 }],
    // Advisors
    ["0xe3697cb32ab0a61364914b29e16c4ca78fbd558f", { category: "ADVISORS", allocation: 3000000 }],
    // Team
    ["0x5bdfd6cd7567fd9255f854edb77890873751eaf6", { category: "TEAM", allocation: 3000000 }],
    ["0xb7b6108abead130d9826a0d78745ad68b21d9c12", { category: "TEAM", allocation: 3000000 }],
]);

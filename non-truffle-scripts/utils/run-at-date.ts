// setTimeout has a limit of 32 bits for the delay argument
export const runAtDate = async (date: Date, func: () => void) => {
    var now = new Date().getTime();
    var then = date.getTime();
    var diff = Math.max(then - now, 0);
    if (diff > 0x7fffffff)
        // setTimeout limit is MAX_INT32=(2^31-1)
        setTimeout(async () => {
            runAtDate(date, func);
        }, 0x7fffffff);
    else setTimeout(func, diff);
};

let nf = Intl.NumberFormat('sv-SE');
export const formatNumber = (number) => {
    if (typeof number === 'string') {
        number = parseInt(number);
    }
    return nf.format(number);
};

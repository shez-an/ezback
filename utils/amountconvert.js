 const calculateTotalOrderAmount = (items) => {
    if (!items || !items.length) {
      throw new Error("Invalid items array");
    }
    // Multiply by 100 to convert to cents if required by Stripe
    return items[0].amount * 100;
};
module.exports = {
    calculateTotalOrderAmount,
}
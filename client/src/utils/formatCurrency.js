export function formatPaiseToRupees(paise) {
  if (typeof paise !== 'number' || isNaN(paise)) {
    return '₹0';
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(rupees);
}

export function rupeesToPaise(rupees) {
  const numeric = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}

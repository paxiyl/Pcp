/*
  Turning what somebody typed into an amount, and back.

  Every price in this system is an integer number of paise, and the two places
  that cross the boundary are `parseRupees` (a shopkeeper's keyboard to the
  database) and `formatPrice` (the database to a price tag). Neither fails
  loudly. Read "120" as 120 instead of 12000 and a shop sells atta for ₹1.20
  until a customer notices; `Number("120.5") * 100` is 12050.000000000002, which
  is how a float reaches a field documented as an integer; and Hermes ships a
  trimmed ICU on some Android builds, so the Indian digit grouping is done by
  hand and can silently become the Western one.

  So both directions are exercised here, including the round trip, which is the
  property that actually matters: what the owner typed is what the customer sees.
*/
const repo = new URL("../../../../", import.meta.url).pathname;

const { formatPrice, formatPriceExact, parseRupees, formatDiscount } = await import(
  `${repo}mobile/src/lib/format.ts`
);

const checks = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
};

console.log("\nWhat a shopkeeper typed, in paise");
check("a whole number of rupees", parseRupees("120"), 12000);
check("the figure a price tag carries", parseRupees("42.50"), 4250);
check("one decimal place", parseRupees("99.5"), 9950);
check("the float that is not 12050", parseRupees("120.5"), 12050);
check("zero is a price (a free sample)", parseRupees("0"), 0);
check("spaces around it", parseRupees("  265  "), 26500);
check("a rupee sign they typed anyway", parseRupees("₹265"), 26500);
check("a thousands comma", parseRupees("1,250"), 125000);

/* Everything that is not a plain positive amount must be refused, not guessed. */
console.log("\nRefused rather than guessed");
check("empty", parseRupees(""), null);
check("letters", parseRupees("abc"), null);
check("a price with letters in it", parseRupees("265rs"), null);
check("negative", parseRupees("-10"), null);
check("three decimal places is a typo", parseRupees("12.345"), null);
check("two dots", parseRupees("1.2.3"), null);
check("a bare dot", parseRupees("."), null);
check("a leading dot", parseRupees(".5"), null);
check("a trailing dot", parseRupees("5."), null);
check("scientific notation", parseRupees("1e3"), null);
check("infinity", parseRupees("Infinity"), null);
check("a plus sign", parseRupees("+10"), null);

console.log("\nThe price a customer reads");
check("whole rupees carry no paise", formatPrice(4500), "₹45");
check("paise are shown when there are any", formatPrice(4250), "₹42.50");
check("Indian grouping, not Western", formatPrice(123456700), "₹12,34,567");
check("the first comma lands after three digits", formatPrice(100000), "₹1,000");
check("and the next after two", formatPrice(10000000), "₹1,00,000");
check("zero", formatPrice(0), "₹0");
check("exact always shows paise", formatPriceExact(4500), "₹45.00");

console.log("\nThe round trip: what was typed is what is shown");
for (const typed of ["45", "42.50", "265", "1250", "99.5", "0"]) {
  const paise = parseRupees(typed);
  const shown = formatPrice(paise);
  const expected = `₹${Number(typed) % 1 === 0 ? Number(typed).toLocaleString("en-IN") : Number(typed).toFixed(2)}`;

  check(`${typed} survives the round trip`, shown, expected);
}

/* The discount line a product card prints, which divides by the price. */
console.log("\nThe discount badge");
check("a tenth off", formatDiscount(10000, 9000), "10% OFF");
check("no discount is no badge", formatDiscount(9000, 9000), null);
check("an MRP below the price is not a discount", formatDiscount(8000, 9000), null);
check("a zero MRP does not divide by zero", formatDiscount(0, 9000), null);

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);

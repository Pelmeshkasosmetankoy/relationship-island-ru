// Central place for buying premium packs.
//
// Right now this is a FREE STUB: purchasePack() just succeeds without any payment,
// so the app keeps working before store billing is wired up. When we integrate the
// RuStore Pay SDK, ONLY this file changes — the rest of the app calls purchasePack()
// / restorePurchases() and doesn't care how the payment actually happens.
//
// Ownership model: a pack is unlocked for the whole ISLAND (shared setting
// `owned_packs`), so when one partner buys it, both get it. purchasePack() only
// reports success/failure; App.jsx does the actual island unlock on success.

// Flip to true once the RuStore Pay SDK is integrated AND the products below exist
// in RuStore Console. While false, packs unlock for free (current behaviour).
export const BILLING_ENABLED = false;

// Pack key -> RuStore product id + price label shown in the UI.
//   productId  — MUST match the id you create in RuStore Console.
//   priceLabel — for display only; the real charged amount is set in RuStore Console.
export const PACK_PRODUCTS = {
  dvoih: { productId: 'pack_dvoih', priceLabel: '199 ₽' }, // пак «Для двоих»
  more:  { productId: 'pack_more',  priceLabel: '149 ₽' }, // «Морской пак»
};

// "Разблокировать всё" — one bundle purchase that opens every pack at once.
export const ALL_PACKS_PRODUCT = { productId: 'packs_all', priceLabel: '299 ₽' };

export function priceLabel(pack) {
  return PACK_PRODUCTS[pack]?.priceLabel ?? '';
}

// Try to buy a pack.
// Returns { ok: true }            on success (or free-stub unlock),
//         { ok: false, cancelled } if the user backed out,
//         { ok: false, error }     on failure.
export async function purchasePack(pack) {
  if (!BILLING_ENABLED) {
    // FREE STUB: pretend the purchase succeeded so the pack unlocks for now.
    return { ok: true, free: true };
  }

  // ---- real RuStore Pay SDK flow goes here (to be implemented) ----------------
  // const product = PACK_PRODUCTS[pack];
  // if (!product) return { ok: false, error: 'unknown_pack' };
  // try {
  //   const result = await RuStorePay.purchase(product.productId);  // opens RuStore payment
  //   // confirm / (server-)verify the purchase, then:
  //   return { ok: result.success, cancelled: result.cancelled };
  // } catch (e) {
  //   return { ok: false, error: e };
  // }
  return { ok: false, error: 'billing_not_implemented' };
}

// Buy the "unlock everything" bundle. Same result shape as purchasePack().
export async function purchaseAllPacks() {
  if (!BILLING_ENABLED) {
    return { ok: true, free: true }; // free stub for now
  }
  // ---- real RuStore flow for ALL_PACKS_PRODUCT.productId goes here -------------
  return { ok: false, error: 'billing_not_implemented' };
}

// Which packs this account has already bought in the store. Call on launch once
// billing is live, so a reinstall / new device restores purchases. (The island's
// shared `owned_packs` also persists, so the partner keeps the pack regardless.)
export async function restorePurchases() {
  if (!BILLING_ENABLED) return [];
  // ---- real RuStore flow: fetch purchases, map product ids -> pack keys --------
  // const purchases = await RuStorePay.getPurchases();
  // return purchases.map(p => packForProductId(p.productId)).filter(Boolean);
  return [];
}

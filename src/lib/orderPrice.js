// Prix d'une course payé par le client = part coursier (price) + frais DEM
// (demFee) − réduction — même calcul que l'app (core/utils/price_format.dart:
// clientChargeFor). À afficher partout comme « prix » d'une course : `price`
// seul est la part du coursier (hors frais de mise en relation).
export const clientCharge = o => Math.max(0, (o?.price ?? 0) + (o?.demFee ?? 0) - (o?.discountAmount ?? 0))

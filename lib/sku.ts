export function formatSKU(input?: string | null): string {
  const raw = (input ?? "").toString().trim().toUpperCase();
  // Keep only A-Z and 0-9
  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  if (!alnum) {
    // Generate unique SKU with timestamp + random to avoid duplicates
    const timestamp = Date.now().toString().slice(-4); // Last 4 digits
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `SKU${timestamp.slice(-2)}${random}`;
  }
  if (alnum.length === 6) return alnum;
  if (alnum.length > 6) return alnum.slice(0, 6);
  // pad end with zeros to preserve prefix meaning
  return alnum.padEnd(6, "0");
}

/**
 * Generate SKU from product name
 * @param name Product name
 * @returns Generated 6-character SKU (DEPRECATED - use generateProductSKU instead)
 */
export function generateSKUFromName(name: string): string {
  if (!name) return formatSKU("");

  // Remove Vietnamese diacritics and normalize
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  // Extract letters and digits
  const letters = normalized.replace(/[^A-Z]/g, "");
  const digits = normalized.replace(/[^0-9]/g, "");

  // Get acronym from words
  const words = normalized
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const acronym = words.map((w) => w[0]).join("");

  // Combine acronym + letters + digits, prioritize acronym
  let sku = (acronym + letters + digits).replace(/[^A-Z0-9]/g, "");

  if (!sku) {
    // Fallback to timestamp + random if no valid characters
    const timestamp = Date.now().toString().slice(-3);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `PRD${timestamp}${random}`.substring(0, 6);
  }

  return sku.substring(0, 6).padEnd(6, "0");
}

/**
 * Generate Product SKU with format: TP-ddmmyyyy-số
 * @param existingProducts Array of existing products to check for duplicate SKUs
 * @returns Generated SKU in format TP-ddmmyyyy-001, TP-ddmmyyyy-002, etc.
 */
export function generateProductSKU(existingProducts: Array<{ sku: string }> = []): string {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;

  // Count products with same date prefix
  const todayPrefix = `TP-${dateStr}`;
  const countToday = existingProducts.filter((p) =>
    p.sku?.startsWith(todayPrefix)
  ).length;

  const sequence = String(countToday + 1).padStart(3, "0");
  return `TP-${dateStr}-${sequence}`;
}

/**
 * Generate Material SKU with format: NL-ddmmyyyy-số
 * @param existingMaterials Array of existing materials to check for duplicate SKUs
 * @param additionalSkus Additional SKUs to avoid (e.g., from unsaved items in batch)
 * @returns Generated SKU in format NL-ddmmyyyy-001, NL-ddmmyyyy-002, etc.
 */
export function generateMaterialSKU(
  existingMaterials: Array<{ sku?: string }> = [],
  additionalSkus: string[] = []
): string {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;

  // Collect all existing SKUs
  const allSkus = new Set([
    ...existingMaterials.map((m) => m.sku).filter(Boolean),
    ...additionalSkus.filter(Boolean),
  ]);

  // Count materials with same date prefix to determine sequence
  const todayPrefix = `NL-${dateStr}`;
  let sequence = 1;
  
  // Find the next available sequence number
  while (allSkus.has(`${todayPrefix}-${String(sequence).padStart(3, "0")}`)) {
    sequence++;
    if (sequence > 999) break; // Safety limit
  }

  return `${todayPrefix}-${String(sequence).padStart(3, "0")}`;
}

export default { formatSKU, generateSKUFromName, generateProductSKU, generateMaterialSKU };

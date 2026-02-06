/**
 * Script kiểm tra tính toàn vẹn dữ liệu kho
 * 
 * Chạy: npx tsx scripts/check_data_integrity.ts
 * Hoặc copy nội dung các hàm vào Console trình duyệt (F12)
 * 
 * Kiểm tra các vấn đề có thể phát sinh từ bugs đã sửa:
 * 1. Vật liệu trùng tên (duplicate materials)
 * 2. Stock bị sai (inflated/negative)
 * 3. Thiếu supplier_phone
 * 4. Lịch sử nhập kho không khớp với stock hiện tại
 */

// ============================================================
// DÙNG TRONG CONSOLE TRÌNH DUYỆT (F12 → Console)
// Copy từng block bên dưới và paste vào Console
// ============================================================

/*
// ===== BLOCK 1: Kiểm tra vật liệu trùng tên =====

const { data: materials } = await window.__supabase?.from('pin_materials').select('id, name, sku, stock, purchase_price, supplier, supplier_phone') || { data: [] };

if (!materials || materials.length === 0) {
  console.log('❌ Không lấy được dữ liệu. Thử cách khác bên dưới.');
} else {
  // Tìm trùng tên
  const nameMap = new Map();
  materials.forEach(m => {
    const key = m.name?.toLowerCase().trim();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key).push(m);
  });

  const duplicates = [...nameMap.entries()].filter(([_, items]) => items.length > 1);
  
  if (duplicates.length === 0) {
    console.log('✅ Không có vật liệu trùng tên');
  } else {
    console.warn(`⚠️ Tìm thấy ${duplicates.length} nhóm vật liệu trùng tên:`);
    duplicates.forEach(([name, items]) => {
      console.group(`📦 "${items[0].name}" (${items.length} bản ghi)`);
      items.forEach(item => {
        console.log(`  ID: ${item.id} | SKU: ${item.sku} | Stock: ${item.stock} | Giá nhập: ${item.purchase_price}`);
      });
      console.groupEnd();
    });
  }

  // Kiểm tra stock âm
  const negativeStock = materials.filter(m => m.stock < 0);
  if (negativeStock.length > 0) {
    console.warn(`⚠️ ${negativeStock.length} vật liệu có stock ÂM:`);
    negativeStock.forEach(m => console.log(`  ${m.name} (${m.sku}): stock = ${m.stock}`));
  } else {
    console.log('✅ Không có stock âm');
  }

  // Kiểm tra thiếu supplier_phone
  const hasSupplierNoPhone = materials.filter(m => m.supplier && !m.supplier_phone);
  if (hasSupplierNoPhone.length > 0) {
    console.warn(`⚠️ ${hasSupplierNoPhone.length} vật liệu có NCC nhưng THIẾU SĐT NCC`);
  } else {
    console.log('✅ Tất cả vật liệu có NCC đều có SĐT');
  }
}

*/

/*
// ===== BLOCK 2: So sánh stock với lịch sử nhập kho =====

const { data: mats } = await window.__supabase?.from('pin_materials').select('id, name, sku, stock') || { data: [] };
const { data: history } = await window.__supabase?.from('pin_material_history').select('material_id, quantity') || { data: [] };

if (mats && history) {
  // Tính tổng nhập từ lịch sử
  const historyTotals = new Map();
  history.forEach(h => {
    const current = historyTotals.get(h.material_id) || 0;
    historyTotals.set(h.material_id, current + (h.quantity || 0));
  });

  // So sánh
  const mismatches = [];
  mats.forEach(m => {
    const historyQty = historyTotals.get(m.id) || 0;
    // Stock có thể < historyQty nếu đã bán hàng, nhưng không nên > 
    if (m.stock > historyQty && historyQty > 0) {
      mismatches.push({
        name: m.name,
        sku: m.sku,
        currentStock: m.stock,
        totalImported: historyQty,
        difference: m.stock - historyQty,
      });
    }
  });

  if (mismatches.length === 0) {
    console.log('✅ Stock không vượt quá tổng nhập (OK)');
  } else {
    console.warn(`⚠️ ${mismatches.length} vật liệu có stock CAO HƠN tổng nhập (có thể bị duplicate bug):`);
    console.table(mismatches);
  }
} else {
  console.log('❌ Không lấy được dữ liệu');
}

*/

/*
// ===== BLOCK 3: Kiểm tra SKU trùng =====

const { data: allMats } = await window.__supabase?.from('pin_materials').select('id, name, sku, stock') || { data: [] };

if (allMats) {
  const skuMap = new Map();
  allMats.forEach(m => {
    if (!skuMap.has(m.sku)) skuMap.set(m.sku, []);
    skuMap.get(m.sku).push(m);
  });

  const skuDupes = [...skuMap.entries()].filter(([_, items]) => items.length > 1);
  
  if (skuDupes.length === 0) {
    console.log('✅ Không có SKU trùng');
  } else {
    console.warn(`⚠️ ${skuDupes.length} nhóm SKU trùng:`);
    skuDupes.forEach(([sku, items]) => {
      console.log(`  SKU "${sku}": ${items.map(i => `${i.name}(stock:${i.stock})`).join(', ')}`);
    });
  }
}

*/

// ============================================================
// PHIÊN BẢN TỰ ĐỘNG - Dùng với Supabase client có sẵn trong app
// Paste vào component hoặc chạy từ DevTools
// ============================================================

export async function checkDataIntegrity(supabase: any) {
  const results = {
    duplicateNames: [] as any[],
    negativeStock: [] as any[],
    missingSupplierPhone: [] as any[],
    stockMismatches: [] as any[],
    duplicateSkus: [] as any[],
    summary: '',
  };

  try {
    // 1. Lấy tất cả vật liệu
    const { data: materials, error: matErr } = await supabase
      .from('pin_materials')
      .select('id, name, sku, stock, purchase_price, supplier, supplier_phone');

    if (matErr) {
      results.summary = `Lỗi truy vấn: ${matErr.message}`;
      return results;
    }

    if (!materials || materials.length === 0) {
      results.summary = 'Không có dữ liệu vật liệu';
      return results;
    }

    // 2. Kiểm tra trùng tên
    const nameMap = new Map<string, any[]>();
    materials.forEach((m: any) => {
      const key = m.name?.toLowerCase().trim();
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key)!.push(m);
    });
    results.duplicateNames = [...nameMap.entries()]
      .filter(([_, items]) => items.length > 1)
      .map(([name, items]) => ({ name: items[0].name, count: items.length, items }));

    // 3. Stock âm
    results.negativeStock = materials.filter((m: any) => m.stock < 0);

    // 4. Thiếu SĐT NCC
    results.missingSupplierPhone = materials.filter((m: any) => m.supplier && !m.supplier_phone);

    // 5. SKU trùng
    const skuMap = new Map<string, any[]>();
    materials.forEach((m: any) => {
      if (!skuMap.has(m.sku)) skuMap.set(m.sku, []);
      skuMap.get(m.sku)!.push(m);
    });
    results.duplicateSkus = [...skuMap.entries()]
      .filter(([_, items]) => items.length > 1)
      .map(([sku, items]) => ({ sku, count: items.length, items }));

    // 6. So sánh stock với lịch sử
    const { data: history } = await supabase
      .from('pin_material_history')
      .select('material_id, quantity');

    if (history) {
      const historyTotals = new Map<string, number>();
      history.forEach((h: any) => {
        const current = historyTotals.get(h.material_id) || 0;
        historyTotals.set(h.material_id, current + (h.quantity || 0));
      });

      materials.forEach((m: any) => {
        const historyQty = historyTotals.get(m.id) || 0;
        if (m.stock > historyQty && historyQty > 0) {
          results.stockMismatches.push({
            name: m.name,
            sku: m.sku,
            currentStock: m.stock,
            totalImported: historyQty,
            difference: m.stock - historyQty,
          });
        }
      });
    }

    // Summary
    const issues: string[] = [];
    if (results.duplicateNames.length > 0) issues.push(`${results.duplicateNames.length} nhóm tên trùng`);
    if (results.negativeStock.length > 0) issues.push(`${results.negativeStock.length} stock âm`);
    if (results.missingSupplierPhone.length > 0) issues.push(`${results.missingSupplierPhone.length} thiếu SĐT NCC`);
    if (results.stockMismatches.length > 0) issues.push(`${results.stockMismatches.length} stock bất thường`);
    if (results.duplicateSkus.length > 0) issues.push(`${results.duplicateSkus.length} SKU trùng`);

    results.summary = issues.length === 0
      ? '✅ Dữ liệu kho sạch, không phát hiện vấn đề!'
      : `⚠️ Phát hiện ${issues.length} loại vấn đề: ${issues.join(', ')}`;

  } catch (err: any) {
    results.summary = `Lỗi kiểm tra: ${err.message}`;
  }

  return results;
}

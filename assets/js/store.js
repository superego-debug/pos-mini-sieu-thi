/* ============================================================
   Phần dữ liệu: đọc/ghi sản phẩm và hóa đơn vào localStorage
   ============================================================ */
var Store = (function () {
  "use strict";

  var KEY_PRODUCTS = "pos.products.v1";
  var KEY_INVOICES = "pos.invoices.v1";

  // Dữ liệu mẫu cho lần mở đầu tiên
  var SEED_PRODUCTS = [
    { id: "SP001", name: "Sữa tươi Vinamilk 1L", category: "Sữa", unit: "Hộp", cost: 24000, price: 32000, stock: 40 },
    { id: "SP002", name: "Mì Hảo Hảo tôm chua cay", category: "Mì gói", unit: "Gói", cost: 3500, price: 5000, stock: 120 },
    { id: "SP003", name: "Nước suối Aquafina 500ml", category: "Nước uống", unit: "Chai", cost: 4000, price: 7000, stock: 80 },
    { id: "SP004", name: "Coca-Cola lon 330ml", category: "Nước uống", unit: "Lon", cost: 8000, price: 12000, stock: 60 },
    { id: "SP005", name: "Bánh mì sandwich", category: "Bánh", unit: "Gói", cost: 12000, price: 18000, stock: 25 },
    { id: "SP006", name: "Trứng gà ta (10 quả)", category: "Thực phẩm", unit: "Vỉ", cost: 28000, price: 38000, stock: 15 },
    { id: "SP007", name: "Gạo ST25 túi 2kg", category: "Thực phẩm", unit: "Túi", cost: 52000, price: 68000, stock: 18 },
    { id: "SP008", name: "Dầu ăn Simply 1L", category: "Gia vị", unit: "Chai", cost: 42000, price: 55000, stock: 12 },
    { id: "SP009", name: "Nước mắm Nam Ngư 500ml", category: "Gia vị", unit: "Chai", cost: 26000, price: 35000, stock: 20 },
    { id: "SP010", name: "Kem đánh răng PS 180g", category: "Hóa mỹ phẩm", unit: "Tuýp", cost: 22000, price: 31000, stock: 16 },
    { id: "SP011", name: "Giấy ăn Bless You", category: "Hóa mỹ phẩm", unit: "Gói", cost: 9000, price: 14000, stock: 35 },
    { id: "SP012", name: "Bánh Oreo gói 133g", category: "Bánh", unit: "Gói", cost: 16000, price: 23000, stock: 4 },
    { id: "SP013", name: "Cà phê G7 hộp 20 gói", category: "Đồ uống", unit: "Hộp", cost: 48000, price: 65000, stock: 9 },
    { id: "SP014", name: "Sữa chua Vinamilk (lốc 4)", category: "Sữa", unit: "Lốc", cost: 20000, price: 28000, stock: 22 }
  ];

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Không đọc được dữ liệu:", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Không ghi được dữ liệu:", key, e);
      return false;
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ------------------------------- sản phẩm ------------------------------- */

  function products() {
    var list = read(KEY_PRODUCTS, null);
    if (!list) {
      list = clone(SEED_PRODUCTS);
      write(KEY_PRODUCTS, list);
    }
    return list;
  }

  function saveProducts(list) {
    write(KEY_PRODUCTS, list);
  }

  function findProduct(id) {
    return products().filter(function (p) { return p.id === id; })[0] || null;
  }

  // Thêm mới nếu chưa có id, ngược lại cập nhật
  function saveProduct(data) {
    var list = products();
    var item = {
      id: data.id || nextProductId(list),
      name: String(data.name || "").trim(),
      category: String(data.category || "Khác").trim(),
      unit: String(data.unit || "Cái").trim(),
      cost: Math.max(0, Number(data.cost) || 0),
      price: Math.max(0, Number(data.price) || 0),
      stock: Math.max(0, Math.round(Number(data.stock) || 0))
    };

    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) { idx = i; break; }
    }
    if (idx >= 0) list[idx] = item;
    else list.push(item);

    saveProducts(list);
    return item;
  }

  function deleteProduct(id) {
    saveProducts(products().filter(function (p) { return p.id !== id; }));
  }

  function nextProductId(list) {
    var max = 0;
    list.forEach(function (p) {
      var n = parseInt(String(p.id).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return "SP" + String(max + 1).padStart(3, "0");
  }

  // Trừ tồn kho sau khi bán
  function reduceStock(items) {
    var list = products();
    items.forEach(function (it) {
      var p = list.filter(function (x) { return x.id === it.id; })[0];
      if (p) p.stock = Math.max(0, p.stock - it.qty);
    });
    saveProducts(list);
  }

  /* ------------------------------- hóa đơn ------------------------------- */

  function invoices() {
    return read(KEY_INVOICES, []);
  }

  function saveInvoices(list) {
    write(KEY_INVOICES, list);
  }

  function addInvoice(invoice) {
    var list = invoices();
    list.unshift(invoice);
    saveInvoices(list);
    return invoice;
  }

  function deleteInvoice(id) {
    saveInvoices(invoices().filter(function (iv) { return iv.id !== id; }));
  }

  function findInvoice(id) {
    return invoices().filter(function (iv) { return iv.id === id; })[0] || null;
  }

  // Mã hóa đơn dạng HD + ngày + số thứ tự trong ngày
  function nextInvoiceCode(date) {
    var d = date || new Date();
    var stamp = d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
    var sameDay = invoices().filter(function (iv) {
      return String(iv.code || "").indexOf("HD" + stamp) === 0;
    });
    return "HD" + stamp + "-" + String(sameDay.length + 1).padStart(3, "0");
  }

  /* ------------------------------- thống kê ------------------------------- */

  function sameDay(iso, date) {
    var d = new Date(iso);
    return d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate();
  }

  function sameMonth(iso, date) {
    var d = new Date(iso);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
  }

  function stats(now) {
    var today = now || new Date();
    var list = invoices();
    var todayList = list.filter(function (iv) { return sameDay(iv.time, today); });
    var monthList = list.filter(function (iv) { return sameMonth(iv.time, today); });
    var prods = products();

    var sum = function (arr) { return arr.reduce(function (s, iv) { return s + iv.total; }, 0); };

    // Bán chạy 30 ngày gần nhất
    var from = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
    var sold = {};
    list.filter(function (iv) { return new Date(iv.time) >= from; }).forEach(function (iv) {
      iv.items.forEach(function (it) {
        if (!sold[it.id]) sold[it.id] = { name: it.name, qty: 0, revenue: 0 };
        sold[it.id].qty += it.qty;
        sold[it.id].revenue += it.qty * it.price;
      });
    });
    var top = Object.keys(sold).map(function (k) { return sold[k]; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 8);

    return {
      revenueToday: sum(todayList),
      countToday: todayList.length,
      revenueMonth: sum(monthList),
      countMonth: monthList.length,
      lowStock: prods.filter(function (p) { return p.stock <= 5; }).length,
      stockValue: prods.reduce(function (s, p) { return s + p.cost * p.stock; }, 0),
      productCount: prods.length,
      top: top
    };
  }

  return {
    products: products,
    saveProduct: saveProduct,
    deleteProduct: deleteProduct,
    findProduct: findProduct,
    reduceStock: reduceStock,
    invoices: invoices,
    addInvoice: addInvoice,
    deleteInvoice: deleteInvoice,
    findInvoice: findInvoice,
    nextInvoiceCode: nextInvoiceCode,
    stats: stats,
    inventory: function () {
      return products().map(function (p) {
        return { id: p.id, name: p.name, stock: p.stock, unit: p.unit };
      });
    }
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Store;
}

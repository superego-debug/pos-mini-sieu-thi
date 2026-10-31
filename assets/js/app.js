/* ============================================================
   Phần giao diện: bán hàng, quản lý sản phẩm, hóa đơn, thống kê
   ============================================================ */
(function () {
  "use strict";

  var SHOP = {
    name: "SIÊU THỊ MINI AN BÌNH",
    address: "123 Nguyễn Văn Cừ, Quận 5, TP.HCM",
    phone: "0909 123 456"
  };

  /* -------------------------------------------------- tiện ích */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function money(n) {
    var v = Math.round(Number(n) || 0);
    return v.toLocaleString("vi-VN") + " ₫";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function timeText(iso) {
    var d = new Date(iso);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + " " +
      pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.hidden = true; }, 220);
    }, 1900);
  }

  function openModal(id) { $("#" + id).hidden = false; }
  function closeModal(id) { $("#" + id).hidden = true; }

  /* -------------------------------------------------- trạng thái */
  var cart = [];          // [{id, name, unit, price, qty}]
  var activeCategory = "Tất cả";
  var searchText = "";
  var discount = 0;
  var lastInvoice = null;

  /* -------------------------------------------------- tab */
  function switchTab(name) {
    $all(".tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    $all(".tab-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    if (name === "thong-ke") renderStats();
    if (name === "hoa-don") renderInvoices();
  }

  /* -------------------------------------------------- đồng hồ */
  function tick() {
    var d = new Date();
    var days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    $("#clock-time").textContent = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    $("#clock-date").textContent = days[d.getDay()] + ", " + pad2(d.getDate()) + "/" +
      pad2(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  /* -------------------------------------------------- danh mục */
  function renderCategories() {
    var cats = ["Tất cả"];
    Store.products().forEach(function (p) {
      if (cats.indexOf(p.category) === -1) cats.push(p.category);
    });

    var box = $("#category-chips");
    box.innerHTML = cats.map(function (c) {
      return '<button class="chip' + (c === activeCategory ? " active" : "") +
        '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");

    var dl = $("#category-list");
    dl.innerHTML = cats.filter(function (c) { return c !== "Tất cả"; })
      .map(function (c) { return "<option value=\"" + esc(c) + "\">"; }).join("");
  }

  /* -------------------------------------------------- lưới sản phẩm */
  function renderProducts() {
    var list = Store.products().filter(function (p) {
      var okCat = activeCategory === "Tất cả" || p.category === activeCategory;
      var q = searchText.trim().toLowerCase();
      var okText = !q || p.name.toLowerCase().indexOf(q) >= 0 || p.id.toLowerCase().indexOf(q) >= 0;
      return okCat && okText;
    });

    var grid = $("#product-grid");
    grid.innerHTML = list.map(function (p) {
      var out = p.stock <= 0;
      var low = !out && p.stock <= 5;
      return '<button class="product-card' + (out ? " out" : "") + (low ? " low" : "") +
        '" data-id="' + p.id + '"' + (out ? " disabled" : "") + ">" +
        '<span class="pc-name">' + esc(p.name) + "</span>" +
        '<span class="pc-price">' + money(p.price) + "</span>" +
        '<span class="pc-meta"><span>' + esc(p.unit) + "</span><span>còn " + p.stock + "</span></span>" +
        "</button>";
    }).join("");

    $("#product-empty").hidden = list.length > 0;
  }

  /* -------------------------------------------------- giỏ hàng */
  function addToCart(id) {
    var p = Store.findProduct(id);
    if (!p) return;

    var line = cart.filter(function (c) { return c.id === id; })[0];
    var inCart = line ? line.qty : 0;

    if (inCart + 1 > p.stock) {
      toast("Không đủ hàng: " + p.name + " chỉ còn " + p.stock);
      return;
    }
    if (line) line.qty += 1;
    else cart.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty: 1 });

    renderCart();
  }

  function changeQty(id, delta) {
    var line = cart.filter(function (c) { return c.id === id; })[0];
    if (!line) return;
    var p = Store.findProduct(id);
    var max = p ? p.stock : 9999;
    var next = line.qty + delta;

    if (next > max) { toast("Chỉ còn " + max + " " + line.unit); return; }
    if (next <= 0) { cart = cart.filter(function (c) { return c.id !== id; }); }
    else line.qty = next;
    renderCart();
  }

  function removeLine(id) {
    cart = cart.filter(function (c) { return c.id !== id; });
    renderCart();
  }

  function subtotal() {
    return cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
  }

  function total() {
    return Math.max(0, subtotal() - discount);
  }

  function cartCount() {
    return cart.reduce(function (s, c) { return s + c.qty; }, 0);
  }

  function renderCart() {
    var box = $("#cart-list");

    box.innerHTML = cart.map(function (c) {
      return '<div class="cart-item" data-id="' + c.id + '">' +
        '<div><div class="ci-name">' + esc(c.name) + "</div>" +
        '<div class="ci-unit">' + money(c.price) + " / " + esc(c.unit) + "</div></div>" +
        '<div class="ci-line">' + money(c.price * c.qty) + "</div>" +
        '<div class="qty">' +
        '<button data-act="dec" aria-label="Giảm">−</button>' +
        "<span>" + c.qty + "</span>" +
        '<button data-act="inc" aria-label="Tăng">+</button>' +
        "</div>" +
        '<div class="ci-line"><button class="link danger" data-act="del">Xóa</button></div>' +
        "</div>";
    }).join("");

    $("#cart-empty").hidden = cart.length > 0;

    $("#sum-subtotal").textContent = money(subtotal());
    $("#sum-total").textContent = money(total());
    $("#btn-checkout").disabled = cart.length === 0;

    $("#brand-sub").textContent = cart.length
      ? cartCount() + " món trong giỏ"
      : "Quản lý bán hàng & hóa đơn";
  }

  /* -------------------------------------------------- thanh toán */
  function openCheckout() {
    if (!cart.length) return;
    $("#pay-total").textContent = money(total());
    $("#pay-method").value = "Tiền mặt";
    $("#pay-cash").value = "";
    $("#pay-customer").value = "";
    $("#pay-change").textContent = money(0);
    $("#field-cash").hidden = false;
    openModal("modal-checkout");
    setTimeout(function () { $("#pay-cash").focus(); }, 50);
  }

  function updateChange() {
    var cash = Number($("#pay-cash").value) || 0;
    var change = cash - total();
    $("#pay-change").textContent = money(change > 0 ? change : 0);
  }

  function confirmPay() {
    if (!cart.length) return;

    var method = $("#pay-method").value;
    var cash = Number($("#pay-cash").value) || 0;
    var t = total();

    if (method === "Tiền mặt" && cash > 0 && cash < t) {
      toast("Tiền khách đưa chưa đủ");
      return;
    }

    var now = new Date();
    var invoice = {
      id: "IV" + now.getTime(),
      code: Store.nextInvoiceCode(now),
      time: now.toISOString(),
      items: cart.map(function (c) {
        return { id: c.id, name: c.name, unit: c.unit, price: c.price, qty: c.qty };
      }),
      subtotal: subtotal(),
      discount: discount,
      total: t,
      method: method,
      cash: method === "Tiền mặt" ? cash || t : t,
      change: method === "Tiền mặt" ? Math.max(0, (cash || t) - t) : 0,
      customer: $("#pay-customer").value.trim() || "Khách lẻ"
    };

    Store.addInvoice(invoice);
    Store.reduceStock(invoice.items);
    lastInvoice = invoice;

    cart = [];
    discount = 0;
    $("#input-discount").value = 0;

    closeModal("modal-checkout");
    renderCart();
    renderProducts();
    renderCategories();
    renderInvoices();
    renderStats();
    showReceipt(invoice);
    toast("Đã lưu hóa đơn " + invoice.code);
  }

  /* -------------------------------------------------- hóa đơn giấy */
  function receiptHTML(iv) {
    var rows = iv.items.map(function (it, i) {
      return "<tr><td>" + (i + 1) + ". " + esc(it.name) + "<br><span style=\"font-size:10.5px;color:#666\">" +
        it.qty + " × " + money(it.price) + "</span></td>" +
        '<td class="r" style="vertical-align:bottom">' + money(it.qty * it.price) + "</td></tr>";
    }).join("");

    return "" +
      "<h4>" + esc(SHOP.name) + "</h4>" +
      '<p class="shop">' + esc(SHOP.address) + "<br>ĐT: " + esc(SHOP.phone) + "</p>" +
      "<h4 style=\"font-size:13px\">HÓA ĐƠN BÁN LẺ</h4>" +
      '<div class="meta"><span>Số: ' + esc(iv.code) + "</span><span>" + timeText(iv.time) + "</span></div>" +
      '<div class="meta"><span>Khách: ' + esc(iv.customer) + "</span><span>Thu ngân: Quầy 1</span></div>" +
      "<table><thead><tr><th>Mặt hàng</th><th class=\"r\">T.Tiền</th></tr></thead><tbody>" +
      rows + "</tbody></table>" +
      '<div class="sum">' +
      "<div><span>Tạm tính</span><span>" + money(iv.subtotal) + "</span></div>" +
      (iv.discount ? "<div><span>Giảm giá</span><span>−" + money(iv.discount) + "</span></div>" : "") +
      '<div class="big"><span>Tổng cộng</span><span>' + money(iv.total) + "</span></div>" +
      "<div><span>Thanh toán (" + esc(iv.method) + ")</span><span>" + money(iv.cash) + "</span></div>" +
      "<div><span>Tiền thối</span><span>" + money(iv.change) + "</span></div>" +
      "</div>" +
      '<p class="thanks">Cảm ơn quý khách, hẹn gặp lại!<br>Hóa đơn in lúc ' + timeText(new Date().toISOString()) + "</p>";
  }

  function showReceipt(iv) {
    $("#receipt-print").innerHTML = receiptHTML(iv);
    openModal("modal-receipt");
  }

  /* -------------------------------------------------- bảng sản phẩm */
  function renderAdmin() {
    var q = ($("#search-admin").value || "").trim().toLowerCase();
    var list = Store.products().filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0 ||
        p.id.toLowerCase().indexOf(q) >= 0 || p.category.toLowerCase().indexOf(q) >= 0;
    });

    var html = list.map(function (p) {
      var cls = p.stock <= 0 ? "stock-out" : (p.stock <= 5 ? "stock-low" : "");
      return "<tr>" +
        "<td>" + esc(p.id) + "</td>" +
        "<td>" + esc(p.name) + "</td>" +
        "<td>" + esc(p.category) + "</td>" +
        '<td class="num">' + money(p.cost) + "</td>" +
        '<td class="num">' + money(p.price) + "</td>" +
        '<td class="num ' + cls + '">' + p.stock + " " + esc(p.unit) + "</td>" +
        '<td class="right"><span class="row-actions">' +
        '<button class="mini" data-edit="' + p.id + '">Sửa</button>' +
        '<button class="mini danger" data-del="' + p.id + '">Xóa</button>' +
        "</span></td>" +
        "</tr>";
    }).join("");

    $("#product-table").querySelector("tbody").innerHTML = html;
  }

  function openProductForm(id) {
    var p = id ? Store.findProduct(id) : null;
    $("#product-modal-title").textContent = p ? "Sửa sản phẩm" : "Thêm sản phẩm";
    $("#pf-id").value = p ? p.id : "";
    $("#pf-name").value = p ? p.name : "";
    $("#pf-category").value = p ? p.category : "";
    $("#pf-unit").value = p ? p.unit : "";
    $("#pf-cost").value = p ? p.cost : "";
    $("#pf-price").value = p ? p.price : "";
    $("#pf-stock").value = p ? p.stock : "";
    openModal("modal-product");
    setTimeout(function () { $("#pf-name").focus(); }, 50);
  }

  function saveProductForm() {
    var name = $("#pf-name").value.trim();
    if (!name) { toast("Chưa nhập tên hàng"); return; }

    var price = Number($("#pf-price").value) || 0;
    if (price <= 0) { toast("Giá bán phải lớn hơn 0"); return; }

    Store.saveProduct({
      id: $("#pf-id").value || null,
      name: name,
      category: $("#pf-category").value.trim() || "Khác",
      unit: $("#pf-unit").value.trim() || "Cái",
      cost: Number($("#pf-cost").value) || 0,
      price: price,
      stock: Number($("#pf-stock").value) || 0
    });

    closeModal("modal-product");
    renderAdmin();
    renderProducts();
    renderCategories();
    renderStats();
    toast("Đã lưu sản phẩm");
  }

  /* -------------------------------------------------- bảng hóa đơn */
  function renderInvoices() {
    var date = $("#filter-date").value;
    var list = Store.invoices().filter(function (iv) {
      if (!date) return true;
      return iv.time.slice(0, 10) === date;
    });

    var html = list.map(function (iv) {
      return "<tr>" +
        "<td><strong>" + esc(iv.code) + "</strong></td>" +
        "<td>" + timeText(iv.time) + "</td>" +
        '<td class="num">' + iv.items.reduce(function (s, i) { return s + i.qty; }, 0) + "</td>" +
        '<td class="num"><strong>' + money(iv.total) + "</strong></td>" +
        "<td>" + esc(iv.method) + "</td>" +
        '<td class="right"><span class="row-actions">' +
        '<button class="mini" data-view="' + iv.id + '">Xem</button>' +
        '<button class="mini" data-print="' + iv.id + '">In</button>' +
        '<button class="mini danger" data-delinvoice="' + iv.id + '">Xóa</button>' +
        "</span></td>" +
        "</tr>";
    }).join("");

    $("#invoice-table").querySelector("tbody").innerHTML = html;
    $("#invoice-empty").hidden = list.length > 0;
  }

  /* -------------------------------------------------- thống kê */
  function renderChart() {
    var now = new Date();
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ date: d, total: 0 });
    }

    Store.invoices().forEach(function (iv) {
      var t = new Date(iv.time);
      days.forEach(function (day) {
        if (t.getFullYear() === day.date.getFullYear() &&
            t.getMonth() === day.date.getMonth() &&
            t.getDate() === day.date.getDate()) {
          day.total += iv.total;
        }
      });
    });

    var max = Math.max.apply(null, days.map(function (d) { return d.total; }).concat([1]));

    $("#chart").innerHTML = days.map(function (d, i) {
      var pct = Math.round((d.total / max) * 100);
      var isToday = i === days.length - 1;
      return '<div class="col">' +
        '<span class="bar-val">' + (d.total ? Math.round(d.total / 1000) + "k" : "") + "</span>" +
        '<div class="bar' + (isToday ? " today" : "") + (d.total ? "" : " zero") +
        '" style="height:' + Math.max(3, pct) + '%"></div>' +
        '<span class="bar-day">' + pad2(d.date.getDate()) + "/" + pad2(d.date.getMonth() + 1) + "</span>" +
        "</div>";
    }).join("");
  }

  function renderStats() {
    renderChart();
    var s = Store.stats(new Date());
    $("#stat-today").textContent = money(s.revenueToday);
    $("#stat-today-count").textContent = s.countToday + " hóa đơn";
    $("#stat-month").textContent = money(s.revenueMonth);
    $("#stat-month-count").textContent = s.countMonth + " hóa đơn";
    $("#stat-lowstock").textContent = s.lowStock;
    $("#stat-stock-value").textContent = money(s.stockValue);
    $("#stat-product-count").textContent = s.productCount + " mặt hàng";

    $("#top-table").querySelector("tbody").innerHTML = s.top.map(function (t, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(t.name) + "</td>" +
        '<td class="num">' + t.qty + '</td><td class="num">' + money(t.revenue) + "</td></tr>";
    }).join("");
    $("#top-empty").hidden = s.top.length > 0;
  }

  /* -------------------------------------------------- gắn sự kiện */
  function bind() {
    // chuyển tab
    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (b) switchTab(b.dataset.tab);
    });

    // tìm hàng + chọn nhóm
    $("#search-product").addEventListener("input", function (e) {
      searchText = e.target.value;
      renderProducts();
    });

    $("#category-chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      activeCategory = b.dataset.cat;
      renderCategories();
      renderProducts();
    });

    // bấm vào sản phẩm
    $("#product-grid").addEventListener("click", function (e) {
      var card = e.target.closest(".product-card");
      if (card && !card.disabled) addToCart(card.dataset.id);
    });

    // thao tác trong giỏ
    $("#cart-list").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var id = e.target.closest(".cart-item").dataset.id;
      var act = btn.dataset.act;
      if (act === "inc") changeQty(id, 1);
      else if (act === "dec") changeQty(id, -1);
      else if (act === "del") removeLine(id);
    });

    $("#btn-clear-cart").addEventListener("click", function () {
      if (!cart.length) return;
      if (confirm("Xóa toàn bộ giỏ hàng?")) {
        cart = [];
        renderCart();
      }
    });

    // giảm giá
    $("#input-discount").addEventListener("input", function (e) {
      discount = Math.max(0, Number(e.target.value) || 0);
      if (discount > subtotal()) discount = subtotal();
      $("#sum-total").textContent = money(total());
    });

    // thanh toán
    $("#btn-checkout").addEventListener("click", openCheckout);
    $("#pay-cash").addEventListener("input", updateChange);
    $("#pay-method").addEventListener("change", function (e) {
      var isCash = e.target.value === "Tiền mặt";
      $("#field-cash").hidden = !isCash;
      if (!isCash) $("#pay-change").textContent = money(0);
    });
    $("#btn-confirm-pay").addEventListener("click", confirmPay);
    $("#btn-print").addEventListener("click", function () { window.print(); });

    // quản lý sản phẩm
    $("#btn-add-product").addEventListener("click", function () { openProductForm(null); });
    $("#btn-save-product").addEventListener("click", saveProductForm);
    $("#search-admin").addEventListener("input", renderAdmin);

    $("#product-table").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-edit]");
      var del = e.target.closest("[data-del]");
      if (ed) openProductForm(ed.dataset.edit);
      if (del) {
        var p = Store.findProduct(del.dataset.del);
        if (confirm("Xóa sản phẩm \"" + p.name + "\"?")) {
          Store.deleteProduct(del.dataset.del);
          renderAdmin(); renderProducts(); renderCategories(); renderStats();
          toast("Đã xóa sản phẩm");
        }
      }
    });

    // hóa đơn
    $("#filter-date").addEventListener("change", renderInvoices);
    $("#btn-clear-filter").addEventListener("click", function () {
      $("#filter-date").value = "";
      renderInvoices();
    });

    $("#invoice-table").addEventListener("click", function (e) {
      var v = e.target.closest("[data-view]") || e.target.closest("[data-print]");
      var d = e.target.closest("[data-delinvoice]");
      if (v) {
        var iv = Store.findInvoice(v.dataset.view || v.dataset.print);
        if (iv) showReceipt(iv);
      }
      if (d) {
        if (confirm("Xóa hóa đơn này? Tồn kho sẽ không được hoàn lại.")) {
          Store.deleteInvoice(d.dataset.delinvoice);
          renderInvoices(); renderStats();
          toast("Đã xóa hóa đơn");
        }
      }
    });

    // đóng modal
    $all("[data-close-modal]").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.closest(".modal");
        if (m) m.hidden = true;
      });
    });

    $all(".modal").forEach(function (m) {
      m.addEventListener("click", function (e) {
        if (e.target === m) m.hidden = true;
      });
    });

    // phím tắt
    document.addEventListener("keydown", function (e) {
      if (e.key === "F2") {
        e.preventDefault();
        if (!$("#modal-checkout").hidden) confirmPay();
        else if (cart.length) openCheckout();
      }
      if (e.key === "Escape") {
        $all(".modal").forEach(function (m) { m.hidden = true; });
      }
    });
  }

  /* -------------------------------------------------- khởi động */
  document.addEventListener("DOMContentLoaded", function () {
    bind();
    tick();
    setInterval(tick, 15000);

    renderCategories();
    renderProducts();
    renderCart();
    renderAdmin();
    renderInvoices();
    renderStats();
    $("#filter-date").value = "";
  });
})();

/* Northwind Ledger — sample dashboard behaviour.
   Vanilla JS, no imports. Everything here is a demonstration, not a backend. */

(function () {
  "use strict";

  /* ---------- Mobile navigation ---------- */

  var body = document.body;
  var menuBtn = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  var sidebar = document.getElementById("sidebar");

  function setNav(open) {
    body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    scrim.hidden = !open;
  }

  if (menuBtn && scrim) {
    menuBtn.addEventListener("click", function () {
      setNav(!body.classList.contains("nav-open"));
    });
    scrim.addEventListener("click", function () { setNav(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && body.classList.contains("nav-open")) {
        setNav(false);
        menuBtn.focus();
      }
    });
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNav(false);
    });
  }

  /* ---------- Sample-only buttons ---------- */

  var toast = document.getElementById("toast");
  var toastTimer = null;

  function announceSample() {
    if (!toast) return;
    toast.textContent = "Sample dashboard — this control is not wired to a backend.";
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2400);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (button) {
    button.addEventListener("click", announceSample);
  });

  /* ---------- Chart ---------- */

  var ranges = {
    "9w": {
      total: "$284,102",
      delta: "+$31,480",
      desc: "A rising area chart from 30% to 95% of the scale, ending at $284,102.",
      values: [0.3, 0.44, 0.38, 0.6, 0.52, 0.72, 0.66, 0.85, 0.95],
      labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]
    },
    "6m": {
      total: "$1,420,880",
      delta: "+$214,900",
      desc: "A slowly rising area chart across six months, ending at $1,420,880.",
      values: [0.34, 0.41, 0.38, 0.56, 0.61, 0.74],
      labels: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
    },
    "1y": {
      total: "$2,864,000",
      delta: "+$512,400",
      desc: "A rising area chart across twelve months, ending at $2,864,000.",
      values: [0.2, 0.3, 0.26, 0.42, 0.39, 0.55, 0.5, 0.62, 0.7, 0.68, 0.83, 0.94],
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    }
  };

  var NS = "http://www.w3.org/2000/svg";
  var chart = document.getElementById("chart");
  var areaPath = document.getElementById("chartArea");
  var linePath = document.getElementById("chartLine");
  var dots = document.getElementById("chartDots");
  var axis = document.getElementById("chartLabels");
  var totalEl = document.getElementById("chartTotal");
  var deltaEl = document.getElementById("chartDelta");
  var chartDesc = document.getElementById("chartDesc");

  var W = 660;
  var H = 200;
  var TOP = 16;
  var BOTTOM = 172;
  var PLOT = BOTTOM - TOP;

  function pointsFor(values) {
    var step = (W - 16) / (values.length - 1);
    return values.map(function (value, index) {
      return [8 + index * step, BOTTOM - value * PLOT];
    });
  }

  function smoothPath(points) {
    var d = "M" + points[0][0].toFixed(1) + " " + points[0][1].toFixed(1);
    for (var i = 1; i < points.length; i += 1) {
      var x0 = points[i - 1][0];
      var y0 = points[i - 1][1];
      var x1 = points[i][0];
      var y1 = points[i][1];
      var mx = (x0 + x1) / 2;
      d += " C" + mx.toFixed(1) + " " + y0.toFixed(1) + " " + mx.toFixed(1) + " " + y1.toFixed(1) + " " + x1.toFixed(1) + " " + y1.toFixed(1);
    }
    return d;
  }

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function renderChart(key) {
    var range = ranges[key] || ranges["9w"];
    var points = pointsFor(range.values);
    var line = smoothPath(points);

    linePath.setAttribute("d", line);
    areaPath.setAttribute("d", line + " L" + (W - 8) + " " + BOTTOM + " L8 " + BOTTOM + " Z");

    dots.textContent = "";
    axis.textContent = "";

    points.forEach(function (point, index) {
      var last = index === points.length - 1;
      dots.appendChild(el("circle", {
        cx: point[0].toFixed(1),
        cy: point[1].toFixed(1),
        r: last ? 4.2 : 2.4,
        "class": last ? "last" : ""
      }));

      /* Twelve labels crowd a 660-unit chart, so skip every other one there. */
      if (points.length > 9 && index % 2 === 1 && !last) return;
      var label = el("text", {
        x: point[0].toFixed(1),
        y: H - 8,
        "text-anchor": index === 0 ? "start" : last ? "end" : "middle"
      });
      label.textContent = range.labels[index];
      axis.appendChild(label);
    });

    totalEl.textContent = range.total;
    deltaEl.textContent = range.delta;
    if (chartDesc) chartDesc.textContent = range.desc;
    if (chart) chart.setAttribute("aria-label", "Net movement, " + range.total);
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (other) { other.setAttribute("aria-pressed", String(other === tab)); });
      renderChart(tab.getAttribute("data-range"));
    });
  });

  renderChart("9w");

  /* ---------- Ledger filtering ---------- */

  var rows = Array.prototype.slice.call(document.querySelectorAll("tbody tr"));
  var filters = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var search = document.getElementById("q");
  var empty = document.getElementById("empty");
  var rowCount = document.getElementById("rowCount");
  var clear = document.getElementById("clearSearch");
  var status = "all";

  function applyFilters() {
    var term = (search.value || "").trim().toLowerCase();
    var shown = 0;

    rows.forEach(function (row) {
      var matchesStatus = status === "all" || row.getAttribute("data-status") === status;
      var matchesTerm = !term || row.textContent.toLowerCase().indexOf(term) !== -1;
      var visible = matchesStatus && matchesTerm;
      row.hidden = !visible;
      if (visible) shown += 1;
    });

    empty.hidden = shown !== 0;
    rowCount.textContent = shown + (shown === 1 ? " payment" : " payments") + (shown === rows.length ? "" : " shown");
  }

  filters.forEach(function (chip) {
    chip.addEventListener("click", function () {
      status = chip.getAttribute("data-filter");
      filters.forEach(function (other) { other.setAttribute("aria-pressed", String(other === chip)); });
      applyFilters();
    });
  });

  if (search) search.addEventListener("input", applyFilters);
  if (clear) {
    clear.addEventListener("click", function () {
      search.value = "";
      search.focus();
      applyFilters();
    });
  }

  /* ---------- Toggling a row's status ---------- */

  var unmatchedValue = document.getElementById("unmatchedValue");
  var reviewCount = document.getElementById("reviewCount");

  function updateCounts() {
    var needs = rows.filter(function (row) { return row.getAttribute("data-status") === "review"; }).length;
    if (unmatchedValue) unmatchedValue.textContent = String(needs);
    if (reviewCount) reviewCount.textContent = String(needs);
    applyFilters();
  }

  Array.prototype.forEach.call(document.querySelectorAll(".status"), function (button) {
    button.addEventListener("click", function () {
      var row = button.closest("tr");
      var nowMatched = row.getAttribute("data-status") === "review";
      var account = row.children[1].textContent.trim();

      row.setAttribute("data-status", nowMatched ? "matched" : "review");
      button.className = "status " + (nowMatched ? "matched" : "review");

      var dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      button.textContent = "";
      button.append(dot, document.createTextNode(nowMatched ? "Matched" : "Review"));
      button.setAttribute(
        "aria-label",
        account + (nowMatched ? " is matched. Mark as needing review." : " needs review. Mark as matched.")
      );
      updateCounts();
    });
  });

  /* ---------- Select all ---------- */

  var selectAll = document.getElementById("selectAll");
  var boxes = Array.prototype.slice.call(document.querySelectorAll('tbody input[type="checkbox"]'));
  if (selectAll) {
    selectAll.addEventListener("change", function () {
      boxes.forEach(function (box) { box.checked = selectAll.checked; });
    });
  }

  updateCounts();
})();

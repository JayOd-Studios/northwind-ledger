/* Northwind Ledger — sample workspace behaviour.
 *
 * One state object, rendered into the queue, the table, the KPIs and the
 * chart. Amounts are cents; dates are ISO calendar dates. The sample has no
 * backend: statuses and the activity trail are kept in this browser.
 */

(function () {
  "use strict";

  var DATA = window.NORTHWIND;
  if (!DATA) return;

  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  var STORAGE_KEY = "northwind-ledger-v1";
  var THEME_KEY = "northwind-theme";
  var NS = "http://www.w3.org/2000/svg";
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  var money0 = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  var dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  var activityFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  var initialStatuses = {};
  DATA.payments.forEach(function (payment) {
    initialStatuses[payment.id] = payment.status;
  });
  var initialReviewCount = DATA.payments.filter(function (payment) {
    return payment.status === "review";
  }).length;

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function seedActivity() {
    return {
      at: DATA.meta.asOf,
      text: "Morning reconciliation run found " + initialReviewCount + " exceptions.",
    };
  }

  var saved = loadSaved();
  var statuses = Object.assign({}, initialStatuses);
  if (saved.statuses && typeof saved.statuses === "object") {
    Object.keys(initialStatuses).forEach(function (id) {
      var value = saved.statuses[id];
      if (value === "matched" || value === "review") statuses[id] = value;
    });
  }

  var savedActivity = Array.isArray(saved.activity)
    ? saved.activity
        .filter(function (entry) {
          return entry && typeof entry.at === "string" && typeof entry.text === "string";
        })
        .slice(0, 8)
    : [];

  var state = {
    statuses: statuses,
    activity: savedActivity.length ? savedActivity : [seedActivity()],
    sortKey: "date",
    sortDir: "desc",
    filter: "all",
    query: "",
    selected: new Set(),
    dialogId: null,
  };

  function save() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ statuses: state.statuses, activity: state.activity.slice(0, 8) })
      );
    } catch (error) {
      /* Storage can be unavailable; the page still works for this visit. */
    }
  }

  function isReduced() {
    return reduceQuery.matches;
  }

  function moneyFor(cents) {
    return money.format(cents / 100);
  }

  function moneyWhole(cents) {
    return money0.format(cents / 100);
  }

  function signedMoney(cents) {
    if (cents === 0) return moneyFor(0);
    return (cents > 0 ? "+" : "−") + moneyFor(Math.abs(cents));
  }

  function shortDate(iso) {
    return dateFormat.format(new Date(iso + "T12:00:00"));
  }

  function activityTime(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return activityFormat.format(date).replace(",", "");
  }

  function numberWord(value) {
    var words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
    return words[value] || String(value);
  }

  function allPayments() {
    return DATA.payments.map(function (payment) {
      return Object.assign({}, payment, {
        status: state.statuses[payment.id] || payment.status,
      });
    });
  }

  function reviewPayments() {
    return allPayments().filter(function (payment) {
      return payment.status === "review";
    });
  }

  function clearedCount() {
    return DATA.meta.cleared + initialReviewCount - reviewPayments().length;
  }

  function haystack(payment) {
    return [
      payment.account,
      payment.reference,
      payment.date,
      shortDate(payment.date),
      moneyFor(payment.amount),
      (payment.amount / 100).toFixed(2),
      payment.status === "review" ? "needs review" : "matched",
      payment.reason,
      payment.note,
    ]
      .join(" ")
      .toLowerCase();
  }

  function comparePayments(a, b) {
    var result;
    if (state.sortKey === "amount") {
      result = a.amount - b.amount;
    } else if (state.sortKey === "date") {
      result = a.date.localeCompare(b.date);
    } else {
      result = String(a[state.sortKey]).localeCompare(String(b[state.sortKey]), undefined, {
        sensitivity: "base",
      });
    }
    return state.sortDir === "asc" ? result : -result;
  }

  function visiblePayments() {
    var term = state.query.trim().toLowerCase();
    return allPayments()
      .filter(function (payment) {
        if (state.filter !== "all" && payment.status !== state.filter) return false;
        if (!term) return true;
        return haystack(payment).indexOf(term) !== -1;
      })
      .sort(comparePayments);
  }

  /* ---------- Rendering ---------- */

  function fillDiff(container, payment) {
    container.textContent = "";
    var rows = [
      ["Invoice", payment.expected == null ? "Not provided" : moneyFor(payment.expected)],
      ["Payment", moneyFor(payment.amount)],
      ["Difference", payment.expected == null ? "—" : signedMoney(payment.amount - payment.expected)],
    ];

    rows.forEach(function (row, index) {
      var wrap = document.createElement("div");
      if (index === 2) wrap.className = "diff-total";
      var term = document.createElement("dt");
      term.textContent = row[0];
      var value = document.createElement("dd");
      value.textContent = row[1];
      wrap.append(term, value);
      container.append(wrap);
    });
  }

  function renderHero() {
    var exceptions = reviewPayments().length;
    var cleared = clearedCount();
    var total = DATA.meta.totalPayments;
    var percent = total ? (cleared / total) * 100 : 0;

    $("reconTitle").textContent = exceptions
      ? numberWord(exceptions) +
        (exceptions === 1 ? " payment needs" : " payments need") +
        " a second pair of eyes."
      : "The books are ready to close.";

    $("reconLede").textContent = exceptions
      ? "Every other payment is matched. Clear the exceptions, then export the ledger for Friday’s close."
      : "Every payment is matched. Export the ledger for Friday’s close.";

    $("reconProgress").value = Math.max(0, Math.min(100, percent));
    $("reconProgress").textContent = percent.toFixed(1) + "%";
    $("matchedCount").textContent = cleared.toLocaleString("en-US");
    $("totalCount").textContent = total.toLocaleString("en-US");
    $("progressPercent").textContent = percent.toFixed(1) + "%";

    $("reviewBtnCount").textContent = String(exceptions);
    $("reviewBtnCount").hidden = exceptions === 0;
    $("reviewAll").disabled = exceptions === 0;
    $("navReviewCount").textContent = String(exceptions);

    renderNext();
  }

  function renderSummary() {
    $("balanceValue").textContent = moneyWhole(DATA.meta.balance);
    $("balanceDelta").textContent = "+" + DATA.meta.deltaPercent + "% ";
    var delta = document.createElement("span");
    delta.className = "muted";
    delta.textContent = "vs last month";
    $("balanceDelta").append(delta);

    $("unmatchedValue").textContent = String(reviewPayments().length);
    $("clearedValue").textContent = clearedCount().toLocaleString("en-US");
  }

  function renderNext() {
    var next = reviewPayments()[0];
    var card = $("nextException");
    var clear = $("queueClear");

    if (!next) {
      card.hidden = true;
      clear.hidden = false;
      return;
    }

    card.hidden = false;
    clear.hidden = true;
    $("nextTitle").textContent = next.account;
    $("nextMeta").textContent = next.reference + " · " + shortDate(next.date);
    fillDiff($("nextDiff"), next);
    $("nextReason").textContent = next.reason;
    $("reviewNext").dataset.id = next.id;
  }

  function renderReview() {
    var list = $("reviewList");
    var payments = reviewPayments();
    list.textContent = "";

    payments.forEach(function (payment) {
      var item = document.createElement("li");
      var main = document.createElement("div");
      var who = document.createElement("p");
      who.className = "who";
      who.textContent = payment.account;
      var meta = document.createElement("p");
      meta.className = "tiny muted";
      meta.textContent = payment.reference + " · " + shortDate(payment.date);
      main.append(who, meta);

      var amount = document.createElement("p");
      amount.className = "review-amount";
      amount.textContent = moneyFor(payment.amount);

      var reason = document.createElement("p");
      reason.className = "review-reason";
      reason.textContent = payment.reason;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "text-link review-open";
      button.dataset.id = payment.id;
      button.setAttribute("aria-label", "Review " + payment.account);
      button.textContent = "Review payment";
      button.addEventListener("click", function () {
        openDialog(payment.id);
      });

      item.append(main, amount, reason, button);
      list.append(item);
    });

    list.hidden = payments.length === 0;
    $("reviewEmpty").hidden = payments.length !== 0;
    $("reviewCount").textContent = String(payments.length);
    $("queueFilter").disabled = payments.length === 0;
  }

  function makeRow(payment) {
    var tr = document.createElement("tr");
    tr.dataset.id = payment.id;
    tr.dataset.status = payment.status;
    if (state.selected.has(payment.id)) tr.classList.add("is-selected");

    var checkCell = document.createElement("td");
    var checkLabel = document.createElement("label");
    checkLabel.className = "check";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = state.selected.has(payment.id);
    box.dataset.id = payment.id;
    box.setAttribute("aria-label", "Select " + payment.account);
    box.addEventListener("change", function () {
      if (box.checked) state.selected.add(payment.id);
      else state.selected.delete(payment.id);
      syncSelectionUI();
    });
    checkLabel.append(box);
    checkCell.append(checkLabel);

    var accountCell = document.createElement("td");
    var avatar = document.createElement("span");
    avatar.className = "avatar small";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = payment.initials;
    accountCell.append(avatar, document.createTextNode(payment.account));

    var referenceCell = document.createElement("td");
    referenceCell.className = "mono";
    referenceCell.textContent = payment.reference;

    var dateCell = document.createElement("td");
    dateCell.textContent = shortDate(payment.date);

    var amountCell = document.createElement("td");
    amountCell.className = "right mono";
    amountCell.textContent = moneyFor(payment.amount);

    var statusCell = document.createElement("td");
    var statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = "status" + (payment.status === "review" ? " review" : "");
    statusButton.dataset.id = payment.id;
    statusButton.setAttribute(
      "aria-label",
      payment.account +
        (payment.status === "review"
          ? " needs review. Mark as matched."
          : " is matched. Mark as needing review.")
    );
    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    statusButton.append(dot, document.createTextNode(payment.status === "review" ? "Review" : "Matched"));
    statusButton.addEventListener("click", function () {
      setStatus(payment.id, payment.status === "review" ? "matched" : "review", { focusAfter: true });
    });
    statusCell.append(statusButton);

    tr.append(checkCell, accountCell, referenceCell, dateCell, amountCell, statusCell);
    return tr;
  }

  function emptyMessage() {
    var term = state.query.trim();
    if (term) return "No payments match “" + term + "”.";
    if (state.filter === "review") return "Nothing needs review in this view.";
    if (state.filter === "matched") return "No matched payments in this view.";
    return "No payments to show.";
  }

  function renderLedger() {
    var payments = allPayments();
    var visible = visiblePayments();
    var body = $("ledgerBody");
    body.textContent = "";

    visible.forEach(function (payment) {
      body.append(makeRow(payment));
    });

    var empty = $("empty");
    empty.hidden = visible.length !== 0;
    if (!visible.length) empty.firstChild.nodeValue = emptyMessage() + " ";

    $("countAll").textContent = String(payments.length);
    $("countReview").textContent = String(
      payments.filter(function (payment) { return payment.status === "review"; }).length
    );
    $("countMatched").textContent = String(
      payments.filter(function (payment) { return payment.status === "matched"; }).length
    );
    $("ledgerCount").textContent = String(payments.length);

    $$(".chip[data-filter]").forEach(function (chip) {
      chip.setAttribute("aria-pressed", String(chip.dataset.filter === state.filter));
    });

    var noun = visible.length === 1 ? "payment" : "payments";
    $("rowCount").textContent = visible.length + " of " + payments.length + " " + noun;

    $$(".sort").forEach(function (button) {
      var heading = button.closest("th");
      if (!heading) return;
      heading.setAttribute(
        "aria-sort",
        button.dataset.sort === state.sortKey
          ? state.sortDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      );
    });

    syncSelectionUI();
  }

  function renderActivity() {
    var list = $("activityList");
    list.textContent = "";

    state.activity.slice(0, 6).forEach(function (entry) {
      var item = document.createElement("li");
      var time = document.createElement("time");
      time.dateTime = entry.at;
      time.textContent = activityTime(entry.at);
      var text = document.createElement("p");
      text.textContent = entry.text;
      item.append(time, text);
      list.append(item);
    });
  }

  function syncSelectionUI() {
    var visible = visiblePayments();
    var visibleIds = visible.map(function (payment) { return payment.id; });
    var selectedVisible = visibleIds.filter(function (id) { return state.selected.has(id); });

    $$("#ledgerBody input[type=checkbox]").forEach(function (box) {
      var checked = state.selected.has(box.dataset.id);
      box.checked = checked;
      var row = box.closest("tr");
      if (row) row.classList.toggle("is-selected", checked);
    });

    var selectAll = $("selectAll");
    selectAll.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
    selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    selectAll.disabled = visibleIds.length === 0;

    $("bulkBar").hidden = state.selected.size === 0;
    $("selectedCount").textContent = String(state.selected.size);

    var selectedReview = allPayments().filter(function (payment) {
      return state.selected.has(payment.id) && payment.status === "review";
    });
    $("markSelected").disabled = selectedReview.length === 0;
    $("exportSelected").disabled = state.selected.size === 0;
  }

  function renderAll() {
    renderHero();
    renderSummary();
    renderReview();
    renderLedger();
    renderActivity();
  }

  /* ---------- Activity, status and undo ---------- */

  function addActivity(text, skipRender) {
    var entry = { at: new Date().toISOString(), text: text };
    state.activity.unshift(entry);
    state.activity = state.activity.slice(0, 8);
    save();
    if (!skipRender) renderActivity();
    return entry;
  }

  function undoChanges(previous, entries, message) {
    Object.keys(previous).forEach(function (id) {
      state.statuses[id] = previous[id];
    });
    state.activity = state.activity.filter(function (entry) {
      return entries.indexOf(entry) === -1;
    });
    save();
    renderAll();
    showToast(message);
  }

  function restoreFocus(id) {
    var statusButton = document.querySelector('.status[data-id="' + id + '"]');
    if (statusButton) {
      statusButton.focus();
      return;
    }
    var nextReview = document.querySelector(".review-open");
    if (nextReview) {
      nextReview.focus();
      return;
    }
    var reviewAll = $("reviewAll");
    if (reviewAll && !reviewAll.disabled) {
      reviewAll.focus();
      return;
    }
    $("exportCsv").focus();
  }

  function setStatus(id, next, options) {
    var payment = DATA.payments.find(function (item) { return item.id === id; });
    if (!payment) return;
    var previous = state.statuses[id] || payment.status;
    if (previous === next) return;

    state.statuses[id] = next;
    var message =
      payment.account + (next === "matched" ? " marked as matched." : " sent back for review.");
    var entry = addActivity(message, true);
    save();
    renderAll();
    if (options && options.focusAfter) {
      window.setTimeout(function () { restoreFocus(id); }, 0);
    }
    showToast(message, "Undo", function () {
      undoChanges({ [id]: previous }, [entry], "Change undone.");
    });
  }

  function toggleStatus(id) {
    var payment = allPayments().find(function (item) { return item.id === id; });
    if (!payment) return;
    setStatus(id, payment.status === "review" ? "matched" : "review", { focusAfter: true });
  }

  /* ---------- Dialog ---------- */

  function dialogCopy(payment) {
    if (payment.expected == null) {
      return "No invoice reference arrived with this payment. Check the remittance advice before matching.";
    }
    if (payment.amount !== payment.expected) {
      return "The invoice total and the payment received do not agree. Check the difference before matching.";
    }
    return "This payment looks like another one already in the ledger. Check it before matching again.";
  }

  function openDialog(id) {
    var payment = allPayments().find(function (item) { return item.id === id; });
    if (!payment) return;
    state.dialogId = id;
    $("matchTitle").textContent = payment.account;
    $("matchRef").textContent = payment.reference + " · " + shortDate(payment.date);
    $("matchDesc").textContent = dialogCopy(payment);
    fillDiff($("matchDiff"), payment);
    $("matchReason").textContent = payment.note || "";

    var dialog = $("matchDialog");
    dialog.returnValue = "";
    if (!dialog.open) dialog.showModal();
    var keep = $("matchDialog").querySelector(".dialog-actions .btn.ghost");
    if (keep) keep.focus();
  }

  /* ---------- Selection and export ---------- */

  function csvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function exportCsv(rows, filename) {
    if (!rows.length) {
      showToast("Nothing to export in this view.");
      return;
    }
    var header = ["Account", "Reference", "Date", "Amount (USD)", "Status", "Note"];
    var records = rows.map(function (payment) {
      return [
        payment.account,
        payment.reference,
        payment.date,
        (payment.amount / 100).toFixed(2),
        payment.status === "review" ? "Needs review" : "Matched",
        payment.note || payment.reason || "",
      ];
    });
    var csv = "\ufeff" + [header].concat(records).map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename || "northwind-ledger-2026-11-03.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    addActivity("Exported " + rows.length + (rows.length === 1 ? " payment" : " payments") + " to CSV.", true);
    renderActivity();
    showToast("Exported " + rows.length + (rows.length === 1 ? " payment" : " payments") + " to CSV.");
  }

  function markSelected() {
    var selected = allPayments().filter(function (payment) {
      return state.selected.has(payment.id) && payment.status === "review";
    });
    if (!selected.length) {
      showToast("Select a payment that needs review first.");
      return;
    }

    var previous = {};
    selected.forEach(function (payment) {
      previous[payment.id] = payment.status;
      state.statuses[payment.id] = "matched";
    });
    var message =
      selected.length + (selected.length === 1 ? " payment marked" : " payments marked") + " as matched.";
    var entry = addActivity(message, true);
    state.selected.clear();
    save();
    renderAll();
    showToast(message, "Undo", function () {
      undoChanges(previous, [entry], "Bulk change undone.");
    });
  }

  /* ---------- Chart ---------- */

  var chartRange = "9w";
  var chartPoints = [];
  var chartIndex = 0;
  var CHART = { w: 660, h: 210, top: 16, bottom: 172, left: 56, right: 644 };

  function svgEl(name, attributes) {
    var node = document.createElementNS(NS, name);
    Object.keys(attributes).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    return node;
  }

  function chartPointsFor(values) {
    var plot = CHART.bottom - CHART.top;
    var step = (CHART.right - CHART.left) / (values.length - 1);
    return values.map(function (value, index) {
      return [CHART.left + index * step, CHART.bottom - value * plot];
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
      d +=
        " C" +
        mx.toFixed(1) +
        " " +
        y0.toFixed(1) +
        " " +
        mx.toFixed(1) +
        " " +
        y1.toFixed(1) +
        " " +
        x1.toFixed(1) +
        " " +
        y1.toFixed(1);
    }
    return d;
  }

  function selectChartPoint(index, showCursor) {
    if (!chartPoints.length) return;
    var range = DATA.ranges[chartRange];
    var point = chartPoints[Math.max(0, Math.min(chartPoints.length - 1, index))];
    chartIndex = chartPoints.indexOf(point);

    $("chartReadout").textContent =
      range.labels[chartIndex] + " · " + moneyWhole(range.net[chartIndex]) + " net";

    var cursor = $("chartCursor");
    var dot = $("chartCursorDot");
    cursor.setAttribute("x1", point[0].toFixed(1));
    cursor.setAttribute("x2", point[0].toFixed(1));
    cursor.setAttribute("y1", CHART.top);
    cursor.setAttribute("y2", CHART.bottom);
    dot.setAttribute("cx", point[0].toFixed(1));
    dot.setAttribute("cy", point[1].toFixed(1));
    cursor.classList.toggle("is-hidden", !showCursor);
    dot.classList.toggle("is-hidden", !showCursor);
  }

  function hideChartCursor() {
    $("chartCursor").classList.add("is-hidden");
    $("chartCursorDot").classList.add("is-hidden");
  }

  function renderChart(key, animate) {
    if (!DATA.ranges[key]) key = "9w";
    chartRange = key;
    var range = DATA.ranges[key];
    var points = chartPointsFor(range.values);
    chartPoints = points;
    var line = smoothPath(points);
    var plot = CHART.bottom - CHART.top;

    $("chartLine").setAttribute("d", line);
    $("chartArea").setAttribute(
      "d",
      line + " L" + CHART.right + " " + CHART.bottom + " L" + CHART.left + " " + CHART.bottom + " Z"
    );

    var grid = $("chartGrid");
    var yAxis = $("chartYAxis");
    grid.textContent = "";
    yAxis.textContent = "";
    for (var tick = 0; tick < 5; tick += 1) {
      var ratio = tick / 4;
      var y = CHART.bottom - ratio * plot;
      grid.append(
        svgEl("line", { x1: CHART.left, y1: y.toFixed(1), x2: CHART.right, y2: y.toFixed(1) })
      );
      var label = svgEl("text", { x: CHART.left - 10, y: (y + 3).toFixed(1) });
      label.textContent = range.yticks[tick];
      yAxis.append(label);
    }

    var dots = $("chartDots");
    dots.textContent = "";
    points.forEach(function (point, index) {
      var last = index === points.length - 1;
      dots.append(
        svgEl("circle", {
          cx: point[0].toFixed(1),
          cy: point[1].toFixed(1),
          r: last ? 4.2 : 2.4,
          class: last ? "last" : "",
        })
      );
    });

    var axis = $("chartLabels");
    axis.textContent = "";
    points.forEach(function (point, index) {
      var last = index === points.length - 1;
      if (points.length > 9 && index % 2 === 1 && !last) return;
      var text = svgEl("text", {
        x: point[0].toFixed(1),
        y: CHART.h - 8,
        "text-anchor": index === 0 ? "start" : last ? "end" : "middle",
      });
      text.textContent = range.labels[index];
      axis.append(text);
    });

    $("chartTitle").textContent = "Net movement, last " + range.label;
    $("chartDesc").textContent = range.desc;
    $("chartTotal").textContent = moneyWhole(range.total);
    $("chartDelta").textContent = "+" + moneyWhole(range.delta);
    $("chartTableCaption").textContent = "Net movement, last " + range.label;

    var table = $("chartTableBody");
    table.textContent = "";
    range.labels.forEach(function (label, index) {
      var row = document.createElement("tr");
      var heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = label;
      var value = document.createElement("td");
      value.className = "right mono";
      value.textContent = moneyWhole(range.net[index]);
      row.append(heading, value);
      table.append(row);
    });

    $$(".tab").forEach(function (tab) {
      tab.setAttribute("aria-pressed", String(tab.dataset.range === chartRange));
    });

    selectChartPoint(points.length - 1, false);

    if (animate && !isReduced() && typeof $("chart").animate === "function") {
      try {
        $("chart").animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 220,
          easing: "ease-out",
        });
      } catch (error) {
        /* The change is complete without the fade. */
      }
    }
  }

  function chartIndexAt(clientX) {
    var rect = $("chart").getBoundingClientRect();
    if (!rect.width) return chartIndex;
    var x = ((clientX - rect.left) / rect.width) * CHART.w;
    var best = 0;
    var distance = Infinity;
    chartPoints.forEach(function (point, index) {
      var next = Math.abs(point[0] - x);
      if (next < distance) {
        distance = next;
        best = index;
      }
    });
    return best;
  }

  /* ---------- Toast ---------- */

  var toastTimer = null;
  var toastHideTimer = null;
  var toastAction = null;

  function hideToast() {
    var toast = $("toast");
    toast.classList.remove("show");
    toastAction = null;
    window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 220);
  }

  function showToast(message, actionLabel, action) {
    var toast = $("toast");
    var button = $("toastAction");
    window.clearTimeout(toastTimer);
    window.clearTimeout(toastHideTimer);

    $("toastText").textContent = message;
    if (actionLabel && typeof action === "function") {
      button.hidden = false;
      button.textContent = actionLabel;
      toastAction = action;
    } else {
      button.hidden = true;
      toastAction = null;
    }

    toast.hidden = false;
    window.requestAnimationFrame(function () { toast.classList.add("show"); });
    toastTimer = window.setTimeout(hideToast, actionLabel ? 7000 : 3800);
  }

  /* ---------- Theme and navigation ---------- */

  function setTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    $("themeLabel").textContent = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    $("themeColor").setAttribute("content", theme === "light" ? "#f4efe4" : "#0c121c");
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        /* The theme still changes for this visit. */
      }
    }
  }

  var navOpen = false;

  function isMobileNav() {
    return window.matchMedia("(max-width: 960px)").matches;
  }

  function setNav(open, restoreFocus) {
    navOpen = open;
    document.body.classList.toggle("nav-open", open);
    $("menuBtn").setAttribute("aria-expanded", String(open));
    $("scrim").hidden = !open;
    $("shell").inert = open;
    $("sidebar").inert = isMobileNav() && !open;
    $("menuLabel").textContent = open ? "Close navigation" : "Open navigation";

    if (open) {
      var first = $("sidebar").querySelector("nav a");
      if (first) first.focus();
    } else if (restoreFocus !== false) {
      $("menuBtn").focus();
    }
  }

  /* ---------- Wiring ---------- */

  function init() {
    var storedTheme = document.documentElement.getAttribute("data-theme");
    setTheme(storedTheme === "light" ? "light" : "dark", false);
    setNav(false, false);

    $("q").value = "";

    $("themeToggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      setTheme(next, true);
    });

    $("notifyBtn").addEventListener("click", function () {
      showToast("Sample workspace — notifications are not part of this demo.");
    });

    $("menuBtn").addEventListener("click", function () { setNav(!navOpen); });
    $("scrim").addEventListener("click", function () { setNav(false); });
    $("sidebar").addEventListener("click", function (event) {
      if (event.target.closest("a") && navOpen) setNav(false, false);
    });

    var mobileQuery = window.matchMedia("(max-width: 960px)");
    var onViewportChange = function () {
      if (!mobileQuery.matches) {
        if (navOpen) setNav(false, false);
        else $("sidebar").inert = false;
      } else if (!navOpen) {
        $("sidebar").inert = true;
      }
    };
    if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", onViewportChange);
    else mobileQuery.addListener(onViewportChange);

    $("q").addEventListener("input", function () {
      state.query = $("q").value;
      renderLedger();
    });

    $$(".chip[data-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.filter = chip.dataset.filter;
        renderLedger();
      });
    });

    $$(".sort").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "date" || key === "amount" ? "desc" : "asc";
        }
        renderLedger();
      });
    });

    $("selectAll").addEventListener("change", function () {
      var visible = visiblePayments();
      if ($("selectAll").checked) {
        visible.forEach(function (payment) { state.selected.add(payment.id); });
      } else {
        visible.forEach(function (payment) { state.selected.delete(payment.id); });
      }
      syncSelectionUI();
    });

    $("clearSelection").addEventListener("click", function () {
      state.selected.clear();
      syncSelectionUI();
    });

    $("markSelected").addEventListener("click", markSelected);

    $("exportCsv").addEventListener("click", function () {
      exportCsv(visiblePayments(), "northwind-ledger-2026-11-03.csv");
    });

    $("exportClear").addEventListener("click", function () {
      exportCsv(allPayments().sort(comparePayments), "northwind-ledger-2026-11-03.csv");
    });

    $("exportSelected").addEventListener("click", function () {
      var rows = allPayments()
        .filter(function (payment) { return state.selected.has(payment.id); })
        .sort(comparePayments);
      exportCsv(rows, "northwind-ledger-selected.csv");
    });

    $("reviewAll").addEventListener("click", function () {
      if (!reviewPayments().length) return;
      state.filter = "review";
      renderLedger();
      $("review").scrollIntoView({ behavior: isReduced() ? "auto" : "smooth", block: "start" });
      var first = $("review").querySelector(".review-open");
      if (first) {
        window.setTimeout(function () { first.focus(); }, isReduced() ? 0 : 350);
      }
    });

    $("queueFilter").addEventListener("click", function () {
      state.filter = "review";
      renderLedger();
      $("ledger").scrollIntoView({ behavior: isReduced() ? "auto" : "smooth", block: "start" });
      var chip = document.querySelector('.chip[data-filter="review"]');
      if (chip) window.setTimeout(function () { chip.focus(); }, isReduced() ? 0 : 350);
    });

    $("reviewNext").addEventListener("click", function () {
      var id = $("reviewNext").dataset.id;
      if (id) openDialog(id);
    });

    $("clearSearch").addEventListener("click", function () {
      state.query = "";
      state.filter = "all";
      $("q").value = "";
      renderLedger();
      $("q").focus();
    });

    $("resetData").addEventListener("click", function () {
      state.statuses = Object.assign({}, initialStatuses);
      state.activity = [seedActivity()];
      state.filter = "all";
      state.query = "";
      state.sortKey = "date";
      state.sortDir = "desc";
      state.selected.clear();
      $("q").value = "";
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* Nothing to clear. */
      }
      renderAll();
      showToast("Sample data reset.");
    });

    $("toastAction").addEventListener("click", function () {
      var action = toastAction;
      hideToast();
      if (action) action();
    });

    $("matchDialog").addEventListener("close", function () {
      var id = state.dialogId;
      var result = $("matchDialog").returnValue;
      state.dialogId = null;
      $("matchDialog").returnValue = "";
      if (result === "match" && id) setStatus(id, "matched", { focusAfter: true });
    });

    $("matchDialog").addEventListener("click", function (event) {
      if (event.target === $("matchDialog")) $("matchDialog").close("cancel");
    });

    $$(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        renderChart(tab.dataset.range, true);
      });
    });

    var chart = $("chart");
    chart.addEventListener("pointermove", function (event) {
      selectChartPoint(chartIndexAt(event.clientX), true);
    });
    chart.addEventListener("pointerdown", function (event) {
      selectChartPoint(chartIndexAt(event.clientX), true);
    });
    chart.addEventListener("pointerleave", hideChartCursor);
    chart.addEventListener("focus", function () {
      selectChartPoint(chartIndex, true);
    });
    chart.addEventListener("blur", hideChartCursor);
    chart.addEventListener("keydown", function (event) {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;
      event.preventDefault();
      var next = chartIndex;
      if (event.key === "ArrowLeft") next -= 1;
      if (event.key === "ArrowRight") next += 1;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = chartPoints.length - 1;
      selectChartPoint(next, true);
    });

    document.addEventListener("keydown", function (event) {
      var active = document.activeElement;
      var tag = active ? active.tagName : "";
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);

      if (event.key === "Escape" && navOpen) {
        setNav(false);
        return;
      }

      if (event.key === "Escape" && active === $("q") && $("q").value) {
        state.query = "";
        $("q").value = "";
        renderLedger();
        return;
      }

      if (
        event.key === "/" &&
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !$("matchDialog").open
      ) {
        event.preventDefault();
        $("q").focus();
        $("q").select();
      }
    });

    if (location.hostname.endsWith(".github.io")) {
      var galleryLink = document.querySelector(".back-gallery");
      if (galleryLink) galleryLink.remove();
    }

    renderAll();
    renderChart("9w", false);
  }

  init();
})();

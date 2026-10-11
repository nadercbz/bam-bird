/* Bam Bird Bestell Terminal. Bestelllogik, Oberfläche, Küchenmonitor, Abholmonitor.
   Regeln stehen in Bestelllogik.md. Daten kommen aus menu.js (erzeugt von _build/build_menu.py aus Rezepte.md).
   Demo: Bestellungen laufen über localStorage und BroadcastChannel zwischen Tabs. Im Betrieb ersetzt eine API genau die Funktionen im Block API. */
(function(){
"use strict";
var M = window.MENU, R = M.rules, ITEMS = {}; M.items.forEach(function(i){ ITEMS[i.id] = i; });
var Q = new URLSearchParams(location.search), VIEW = Q.get("view") || "kiosk";
var app = document.getElementById("app"), stage = document.getElementById("stage");

/* ---------------- Texte ---------------- */
var T = {
  de: {tap:"Tippen zum Bestellen", here:"Hier essen", go:"Mitnehmen", hereS:"An einem Platz im Laden", goS:"Eingepackt für unterwegs", mode:"Wo isst du?", cart:"Warenkorb", pay:"Bezahlen", checkout:"Zur Kasse",
       total:"Gesamt", items:"Artikel", add:"In den Warenkorb", dips:"Dips", dipsIncl:"Inklusive", pick:"Wähle", of:"von", extraDip:"Weiteren Dip dazu", drink:"Getränk", without:"Ohne", free:"gratis",
       back:"Zurück", more:"Noch was dazu?", moreS:"Passt dazu", skip:"Nein danke, weiter", empty:"Dein Warenkorb ist leer", remove:"Entfernen", card:"Karte", cardS:"Girocard, Kreditkarte, Apple Pay, Google Pay",
       cash:"Bar am Tresen", cashS:"Du bekommst eine Nummer und zahlst an der Kasse", hold:"Bitte Karte oder Handy an das Terminal halten", paid:"Bezahlt!", number:"Deine Nummer", ready:"Wir rufen deine Nummer.",
       readyS:"Auf dem Bildschirm und mit einem lauten BAM!", cashDue:"Bitte jetzt an der Kasse zahlen", newOrder:"Neue Bestellung", allergens:"Allergene", filterT:"Ich vermeide", filterS:"Wir markieren, was nicht passt",
       filterOn:"Allergen Filter", enthalt:"enthält", maybe:"kann enthalten", spuren:"Spuren sind möglich.", out:"Ausverkauft", still:"Bist du noch da?", stillS:"Gleich geht es zurück zum Start.", yes:"Ja, weiter", access:"Barrierefrei",
       vat:"enthaltene MwSt.", combo:"Als Combo sparst du", makeCombo:"Combo daraus machen", staff:"Bitte kurz zum Tresen kommen, das ist eine große Bestellung.", warnAll:"Achtung: enthält", ok:"Okay", cancel:"Abbrechen",
       receipt:"Beleg", print:"Beleg drucken", mail:"Beleg per E-Mail (QR)", pickN:"Noch %n wählen", ready2:"Fertig", prep:"In Arbeit", rm:"Entfernen", minus:"weniger", plus:"mehr", total2:"Summe", note:"Alle Preise in Euro inkl. MwSt.", empty2:"Nichts gefunden"},
  en: {tap:"Touch to order", here:"Eat here", go:"Take away", hereS:"At a table in the store", goS:"Packed for on the go", mode:"Where do you eat?", cart:"Basket", pay:"Pay", checkout:"Checkout",
       total:"Total", items:"items", add:"Add to basket", dips:"Dips", dipsIncl:"Included", pick:"Choose", of:"of", extraDip:"Add another dip", drink:"Drink", without:"Without", free:"free",
       back:"Back", more:"Anything else?", moreS:"Goes well with", skip:"No thanks, continue", empty:"Your basket is empty", remove:"Remove", card:"Card", cardS:"Debit, credit card, Apple Pay, Google Pay",
       cash:"Cash at the counter", cashS:"You get a number and pay at the till", hold:"Please hold your card or phone to the terminal", paid:"Paid!", number:"Your number", ready:"We call your number.",
       readyS:"On the screen and with a loud BAM!", cashDue:"Please pay at the till now", newOrder:"New order", allergens:"Allergens", filterT:"I avoid", filterS:"We mark what does not fit",
       filterOn:"Allergen filter", enthalt:"contains", maybe:"may contain", spuren:"Traces are possible.", out:"Sold out", still:"Are you still there?", stillS:"Back to the start in a moment.", yes:"Yes, continue", access:"Accessible",
       vat:"VAT included", combo:"As a combo you save", makeCombo:"Make it a combo", staff:"Please come to the counter, this is a large order.", warnAll:"Careful: contains", ok:"Okay", cancel:"Cancel",
       receipt:"Receipt", print:"Print receipt", mail:"Receipt by e-mail (QR)", pickN:"Choose %n more", ready2:"Ready", prep:"In progress", rm:"Remove", minus:"less", plus:"more", total2:"Sum", note:"All prices in euro incl. VAT.", empty2:"Nothing found"}
};
/* ---------------- Zustand ---------------- */
var S = {screen: "attract", lang: "de", mode: null, cat: "Combos", cart: [], sheet: null, access: false, filter: [], dlg: null, last: null, payment: null, toast: null};
function t(k){ return (T[S.lang][k] != null ? T[S.lang][k] : T.de[k]) || k; }
function nm(i){ return S.lang === "en" ? i.name_en : i.name; }
function ds(i){ return S.lang === "en" ? i.desc_en : i.desc; }
function eur(c){ return (c / 100).toFixed(2).replace(".", ",") + " €"; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
var uidN = 1;

/* ---------------- Preise und Regeln ---------------- */
function lineUnit(l){ var it = ITEMS[l.id], extra = 0; Object.keys(l.extra || {}).forEach(function(k){ extra += l.extra[k] * M.extra_dip_price; }); return it.price + extra; }
function lineTotal(l){ return lineUnit(l) * l.qty; }
function cartTotal(c){ return c.reduce(function(a, l){ return a + lineTotal(l); }, 0); }
function cartCount(c){ return c.reduce(function(a, l){ return a + l.qty; }, 0); }
/* MwSt. Aufteilung: Speisen 7 %, Getränke 19 %. Combos nach Listenpreisen der Bestandteile. Mit Steuerberater prüfen. */
function vatSplit(l){
  var it = ITEMS[l.id], g = lineUnit(l), out = {7: 0, 19: 0};
  var extra = 0; Object.keys(l.extra || {}).forEach(function(k){ extra += l.extra[k] * M.extra_dip_price; });
  var base = g - extra; out[7] += extra;
  if (it.combo){
    var drink = ITEMS[it.combo.drink === "choice" ? (l.drink || it.drink_choice[0]) : it.combo.drink];
    var parts = [ITEMS[it.combo.burger], ITEMS[it.combo.fries], drink], sum = parts.reduce(function(a, p){ return a + p.price; }, 0);
    parts.forEach(function(p){ out[p.vat] += base * p.price / sum; });
  } else out[it.vat] += base;
  return {7: out[7] * l.qty, 19: out[19] * l.qty};
}
function totals(c){
  var g7 = 0, g19 = 0; c.forEach(function(l){ var v = vatSplit(l); g7 += v[7]; g19 += v[19]; });
  var gross = Math.round(g7 + g19), v7 = Math.round(g7 * 7 / 107), v19 = Math.round(g19 * 19 / 119);
  return {gross: gross, vat7: v7, vat19: v19, net: gross - v7 - v19};
}
function dipsIncl(l){ return ITEMS[l.id].dips_included || 0; }
function dipsCount(l){ return Object.keys(l.dips || {}).reduce(function(a, k){ return a + l.dips[k]; }, 0); }
function lineComplete(l){ var it = ITEMS[l.id]; if (dipsCount(l) !== dipsIncl(l)) return false; if (it.drink_choice && !l.drink) return false; return true; }
function isBurger(it){ return it.cat === "Burger"; }
function sameConfig(a, b){ return JSON.stringify([a.id, a.dips, a.extra, a.drink, a.without]) === JSON.stringify([b.id, b.dips, b.extra, b.drink, b.without]); }
function addLine(l){
  for (var i = 0; i < S.cart.length; i++) if (sameConfig(S.cart[i], l)){ S.cart[i].qty = Math.min(R.max_qty, S.cart[i].qty + l.qty); return S.cart[i]; }
  if (S.cart.length >= R.max_lines){ toast(t("staff")); return null; }
  l.uid = uidN++; S.cart.push(l); return l;
}
/* Upsell Regeln: höchstens 3 Vorschläge, nie etwas, das schon im Warenkorb liegt */
function upsell(){
  var out = [], c = S.cart, has = function(f){ return c.some(function(l){ return f(ITEMS[l.id], l); }); };
  var hasDrink = has(function(i){ return i.cat === "Getränke" || i.combo || i.cat === "Combos"; });
  var loose = c.filter(function(l){ return isBurger(ITEMS[l.id]); });
  if (loose.length){
    var b = ITEMS[loose[0].id], cid = {"the-bam": "combo-bam", "hot-bam": "combo-hot", "mini-bird": "combo-mini"}[b.id];
    if (cid) out.push({why: S.lang === "en" ? "Make it a combo" : "Mach ein Combo daraus", ids: [cid], note: "combo"});
  }
  if (!hasDrink) out.push({why: S.lang === "en" ? "Something to drink?" : "Was zu trinken dazu?", ids: ["limo-pink", "limo-gelb", "cola", "wasser"]});
  if (has(function(i){ return i.cat === "Strips"; }) && !has(function(i){ return i.cat === "Fries" || i.combo || i.cat === "Boxen"; })) out.push({why: S.lang === "en" ? "Fries with that?" : "Pommes dazu?", ids: ["bam-fries", "cheesy-fries"]});
  var dipsHave = 0, dipWish = 0; c.forEach(function(l){ var i = ITEMS[l.id]; if (i.cat === "Dips") dipsHave += l.qty; if (i.cat === "Strips" || i.cat === "Boxen") dipWish += 1; });
  if (dipWish && !dipsHave) out.push({why: S.lang === "en" ? "One more dip?" : "Noch ein Dip?", ids: ["dip-hot-honey", "dip-smoky-bbq", "dip-knoblauch"]});
  return out.slice(0, 3);
}
/* Combo Erkennung: loser Burger + Fries + Getränk im Warenkorb ist als Combo billiger */
function comboHint(){
  var map = {"the-bam": ["combo-bam", "bam-fries"], "hot-bam": ["combo-hot", "cheesy-fries"], "mini-bird": ["combo-mini", "bam-fries"]};
  for (var i = 0; i < S.cart.length; i++){
    var l = S.cart[i], m = map[l.id]; if (!m) continue;
    var fr = S.cart.filter(function(x){ return x.id === m[1]; })[0], dr = S.cart.filter(function(x){ return ITEMS[x.id].cat === "Getränke"; })[0];
    if (fr && dr){ var combo = ITEMS[m[0]], single = ITEMS[l.id].price + ITEMS[m[1]].price + ITEMS[dr.id].price; if (single > combo.price) return {burger: l, fries: fr, drink: dr, combo: combo, save: single - combo.price}; }
  }
  return null;
}
function contains(it, nums){ return nums.filter(function(n){ return it.contains.indexOf(+n) > -1; }); }
function mayHave(it, nums){ return nums.filter(function(n){ return it.may.indexOf(+n) > -1 && it.contains.indexOf(+n) < 0; }); }

/* ---------------- API (Demo: localStorage; Betrieb: Server) ---------------- */
var bc = ("BroadcastChannel" in window) ? new BroadcastChannel("bambird") : null;
function db(){ try { return JSON.parse(localStorage.getItem("bb-orders") || "[]"); } catch(e){ return []; } }
function save(o){ try { localStorage.setItem("bb-orders", JSON.stringify(o)); } catch(e){} if (bc) bc.postMessage("orders"); }
function soldOut(){ try { return JSON.parse(localStorage.getItem("bb-sold") || "[]"); } catch(e){ return []; } }
function setSold(a){ try { localStorage.setItem("bb-sold", JSON.stringify(a)); } catch(e){} if (bc) bc.postMessage("sold"); }
function nextNumber(){
  var d = new Date().toISOString().slice(0, 10), st; try { st = JSON.parse(localStorage.getItem("bb-seq") || "{}"); } catch(e){ st = {}; }
  if (st.d !== d) st = {d: d, n: R.order_start - 1};
  st.n++; try { localStorage.setItem("bb-seq", JSON.stringify(st)); } catch(e){}
  return R.order_prefix + st.n;
}
function buildOrder(method){
  var tt = totals(S.cart), number = nextNumber();
  var lines = S.cart.map(function(l){
    var it = ITEMS[l.id];
    return {item_id: l.id, name: it.name, qty: l.qty, station: it.station, unit_price: lineUnit(l), line_total: lineTotal(l), vat_split: vatSplit(l),
            options: {dips: l.dips || {}, extra_dips: l.extra || {}, drink: l.drink || (it.combo && it.combo.drink !== "choice" ? it.combo.drink : null), without: l.without || []}};
  });
  return {id: "o" + Date.now(), number: number, created_at: new Date().toISOString(), mode: S.mode, language: S.lang, lines: lines, totals: tt,
          payment: {method: method, status: method === "card" ? "paid" : "open"}, status: method === "card" ? "new" : "awaiting_payment", status_log: [{s: method === "card" ? "new" : "awaiting_payment", at: new Date().toISOString()}]};
}
function placeOrder(method){ var o = buildOrder(method), all = db(); all.push(o); save(all); return o; }
function advance(id, status){ var all = db(); all.forEach(function(o){ if (o.id === id){ o.status = status; o.status_log.push({s: status, at: new Date().toISOString()}); if (status === "new") o.payment.status = "paid"; } }); save(all); }

/* ---------------- Hilfen UI ---------------- */
function toast(m){ S.toast = m; render(); setTimeout(function(){ if (S.toast === m){ S.toast = null; render(); } }, 2400); }
function allergenBadges(it, filter){
  var out = it.contains.map(function(n){ return '<i class="' + (filter.indexOf(String(n)) > -1 ? "w" : "") + '">' + n + "</i>"; });
  return out.join("") || "";
}
function sold(it){ return soldOut().indexOf(it.id) > -1; }
function lineDesc(l){
  var it = ITEMS[l.id], parts = [];
  var dn = function(id){ return ITEMS[id].name; };
  var dd = Object.keys(l.dips || {}).filter(function(k){ return l.dips[k]; }).map(function(k){ return l.dips[k] + "× " + dn(k); });
  if (dd.length) parts.push(dd.join(", "));
  var ee = Object.keys(l.extra || {}).filter(function(k){ return l.extra[k]; }).map(function(k){ return "+" + l.extra[k] + "× " + dn(k); });
  if (ee.length) parts.push(ee.join(", "));
  if (l.drink) parts.push(dn(l.drink));
  if (l.without && l.without.length) parts.push(t("without") + " " + l.without.join(", "));
  return parts.join(" · ");
}

/* ---------------- Rendering ---------------- */
function render(){
  if (VIEW !== "kiosk") return;
  var h = "";
  stage.className = (S.access ? "access " : "");
  switch (S.screen){
    case "attract": h = vAttract(); break;
    case "mode": h = vTop(false) + vMode(); break;
    case "menu": h = vTop(true) + vMenu(); break;
    case "upsell": h = vTop(true) + vUpsell(); break;
    case "cart": h = vTop(true) + vCart(); break;
    case "pay": h = vTop(false) + vPay(); break;
    case "wait": h = vTop(false) + '<div class="page center"><h2 class="b" style="margin:0 60px 20px;font-size:84px;color:#D6141C;text-align:center">' + t("hold") + '</h2><div class="spin"></div></div>'; break;
    case "done": h = vDone(); break;
  }
  if (S.access && ["mode", "menu", "upsell", "cart", "pay", "wait"].indexOf(S.screen) > -1) h += '<div class="acc-fill">' + (S.lang === "en" ? "Everything within reach" : "Alles in Reichweite") + '</div>';
  if (S.sheet) h += vSheet();
  if (S.dlg) h += vDlg();
  if (S.toast) h += '<div class="toast">' + esc(S.toast) + "</div>";
  app.innerHTML = h;
  var g = app.querySelector(".grid"); if (g && S._scroll != null){ g.scrollTop = S._scroll; }
  if (S.screen === "attract") startAttract(); else stopAttract();
}
function vTop(showLang){
  return '<div class="top"><img src="assets/line_weiss.svg" alt="Bam Bird" data-act="logo"><div class="tools">' +
    (S.screen === "menu" || S.screen === "mode" ? '<button class="chip' + (S.filter.length ? " on" : "") + '" data-act="afilter">' + t("filterOn") + (S.filter.length ? " (" + S.filter.length + ")" : "") + "</button>" : "") +
    '<button class="chip' + (S.access ? " on" : "") + '" data-act="access" aria-label="' + t("access") + '">♿</button>' +
    '<button class="chip' + (S.lang === "de" ? " on" : "") + '" data-act="lang" data-v="de">DE</button><button class="chip' + (S.lang === "en" ? " on" : "") + '" data-act="lang" data-v="en">EN</button></div></div><div class="karo" style="position:absolute;left:0;right:0;top:150px;z-index:3"></div>';
}
function vAttract(){
  return '<div class="attract" data-act="start"><div><h1 class="b">Bam Bird</h1></div><video id="av" muted playsinline></video><div><div class="tap">' + t("tap") + '</div></div>' +
    '<div class="langs"><button class="chip' + (S.lang === "de" ? " on" : "") + '" data-act="lang" data-v="de">Deutsch</button><button class="chip' + (S.lang === "en" ? " on" : "") + '" data-act="lang" data-v="en">English</button></div><div class="karo" style="width:100%"></div></div>';
}
function vMode(){
  return '<div class="mode"><h2 class="b">' + t("mode") + '</h2><button class="big" data-act="mode" data-v="here"><span class="ico">🍽️</span><span><b>' + t("here") + '</b><span>' + t("hereS") + '</span></span></button>' +
    '<button class="big" data-act="mode" data-v="go"><span class="ico">🛍️</span><span><b>' + t("go") + '</b><span>' + t("goS") + "</span></span></button></div>";
}
function card(it){
  var out = sold(it) || !it.available, c = contains(it, S.filter), m = mayHave(it, S.filter);
  return '<button class="card' + (out ? " out" : "") + '" data-act="open" data-v="' + it.id + '">' + (out ? '<span class="tag">' + t("out") + "</span>" : (c.length ? '<span class="tag">' + t("enthalt") + " " + c.map(function(n){ return (S.lang === "en" ? M.short_en : M.short)[n]; }).join(", ") + "</span>" : "")) +
    '<img src="' + it.img + '" alt="" loading="lazy"><span class="n">' + esc(nm(it)) + '</span><span class="d">' + esc(ds(it)) + '</span><span class="al">' + allergenBadges(it, S.filter) + '</span><span class="pr"><span class="p">' + eur(it.price) + '</span><span class="plus">+</span></span></button>';
}
function vMenu(){
  var cats = M.categories.map(function(c){ var n = S.cart.filter(function(l){ return ITEMS[l.id].cat === c.id; }).reduce(function(a, l){ return a + l.qty; }, 0);
    return '<button class="' + (S.cat === c.id ? "on" : "") + '" data-act="cat" data-v="' + c.id + '">' + c[S.lang] + (n ? '<span class="count">' + n + "×</span>" : "") + "</button>"; }).join("");
  var list = M.items.filter(function(i){ return i.cat === S.cat; });
  var cc = M.categories.filter(function(c){ return c.id === S.cat; })[0];
  var sub = {Strips: S.lang === "en" ? "Dip included" : "Dip inklusive", Boxen: S.lang === "en" ? "All in one box" : "Alles in einer Box", Dips: S.lang === "en" ? "Collect all six" : "Sammle alle sechs", Combos: S.lang === "en" ? "Burger, fries, drink" : "Burger, Fries, Getränk"}[S.cat] || "";
  var n = cartCount(S.cart), tt = cartTotal(S.cart);
  return '<div class="menu"><div class="rail">' + cats + '</div><div class="grid" id="grid"><div class="catt">' + cc[S.lang] + '</div>' + (sub ? '<div class="catd">' + sub + "</div>" : "") + list.map(card).join("") + '</div>' +
    '<div class="cartbar"><div class="l"><b>' + eur(tt) + '</b><span>' + n + " " + t("items") + '</span></div><div class="row"><button class="ghost" data-act="back">' + t("back") + '</button><button class="btn' + (n ? "" : " dis") + '" data-act="toUpsell">' + t("checkout") + "</button></div></div></div>";
}
function vSheet(){
  var s = S.sheet, it = ITEMS[s.l.id], l = s.l, c = contains(it, S.filter);
  var dipsN = dipsIncl(l), have = dipsCount(l), body = "";
  if (dipsN){
    body += '<div class="grp"><h4>' + t("dips") + '</h4><small>' + t("dipsIncl") + ": " + dipsN + " · " + (have === dipsN ? "✓" : t("pickN").replace("%n", dipsN - have)) + '</small><div class="opts">' + M.dip_ids.map(function(id){
      var d = ITEMS[id], n = (l.dips || {})[id] || 0, col = {"dip-bam-sauce": "#F28C38", "dip-cheddar": "#F2B705", "dip-smoky-bbq": "#7A2E14", "dip-knoblauch": "#F3EEDF", "dip-hot-honey": "#E0731B", "dip-sweet-chili": "#E2382B"}[id];
      return '<div class="opt' + (n ? " on" : "") + '"><span class="dot" style="background:' + col + '"></span><span class="nm">' + esc(nm(d)) + '</span><span class="step"><button data-act="dip" data-v="' + id + '" data-d="-1">−</button><span>' + n + '</span><button class="pl" data-act="dip" data-v="' + id + '" data-d="1">+</button></span></div>'; }).join("") + "</div></div>";
  }
  if (it.extra_dips){
    body += '<div class="grp"><h4>' + t("extraDip") + '</h4><small>+' + eur(M.extra_dip_price) + " " + (S.lang === "en" ? "each" : "pro Dip") + '</small><div class="opts">' + M.dip_ids.map(function(id){
      var d = ITEMS[id], n = (l.extra || {})[id] || 0;
      return '<div class="opt' + (n ? " on" : "") + '"><span class="nm">' + esc(nm(d)) + '</span><span class="step"><button data-act="xdip" data-v="' + id + '" data-d="-1">−</button><span>' + n + '</span><button class="pl" data-act="xdip" data-v="' + id + '" data-d="1">+</button></span></div>'; }).join("") + "</div></div>";
  }
  if (it.drink_choice){
    body += '<div class="grp"><h4>' + t("drink") + '</h4><small>' + (S.lang === "en" ? "No extra charge" : "Ohne Aufpreis") + '</small><div class="opts">' + it.drink_choice.map(function(id){ var d = ITEMS[id];
      return '<button class="opt' + (l.drink === id ? " on" : "") + '" data-act="drink" data-v="' + id + '"><span class="nm">' + esc(nm(d)) + "</span></button>"; }).join("") + "</div></div>";
  }
  if (it.without){
    body += '<div class="grp"><h4>' + t("without") + '</h4><small>' + t("free") + '</small><div class="opts">' + it.without.map(function(w){ var on = (l.without || []).indexOf(w) > -1;
      return '<button class="opt' + (on ? " on" : "") + '" data-act="without" data-v="' + esc(w) + '"><span class="nm">' + (S.lang === "en" ? "No " : "Ohne ") + esc(w) + '</span><span>' + (on ? "✓" : "") + "</span></button>"; }).join("") + "</div></div>";
  }
  var al = '<div class="grp"><h4>' + t("allergens") + '</h4><div class="alp">' + (it.contains.map(function(n){ return '<i class="' + (S.filter.indexOf(String(n)) > -1 ? "w" : "") + '">' + n + " " + esc(M.allergens[n][S.lang]) + "</i>"; }).join("") || "<i>–</i>") +
    (it.may.length ? it.may.map(function(n){ return "<i>(" + n + ") " + t("maybe") + "</i>"; }).join("") : "") + '</div><small style="margin-top:12px">' + t("spuren") + "</small></div>";
  var ok = lineComplete(l), tot = lineTotal(l);
  return '<div class="scrim" data-act="closeSheet"></div><div class="sheet"><button class="x" data-act="closeSheet">×</button><div class="hd"><img src="' + it.img + '" alt=""><div><h3>' + esc(nm(it)) + '</h3><p>' + esc(ds(it)) + "</p>" +
    (c.length ? '<div class="warn">⚠ ' + t("warnAll") + " " + c.map(function(n){ return (S.lang === "en" ? M.short_en : M.short)[n]; }).join(", ") + "</div>" : "") + '</div></div><div class="bd">' + body + al + '</div><div class="ft"><div class="qty"><button data-act="qty" data-d="-1">−</button><span>' + l.qty +
    '</span><button data-act="qty" data-d="1">+</button></div><button class="btn' + (ok ? "" : " dis") + '" data-act="addToCart">' + t("add") + " · " + eur(tot) + "</button></div></div>";
}
function vUpsell(){
  var ups = upsell();
  if (!ups.length){ return '<div class="page"></div>'; }
  var h = '<div class="page"><h2>' + t("more") + '</h2><div class="sub">' + t("moreS") + '</div><div class="ups">';
  ups.forEach(function(u){
    h += '<div class="why">' + u.why + "</div>";
    u.ids.forEach(function(id){ var it = ITEMS[id]; if (sold(it) || !it.available) return; h += card(it); });
  });
  return h + '</div><div class="sum"><div class="acts"><button class="ghost" style="color:#1A0A0A" data-act="back2">' + t("back") + '</button><button class="btn" data-act="toCart">' + t("skip") + "</button></div></div></div>";
}
function vCart(){
  var hint = comboHint(), tt = totals(S.cart);
  var lines = S.cart.map(function(l){ var it = ITEMS[l.id];
    return '<div class="line"><img src="' + it.img + '" alt=""><div class="t"><b>' + esc(nm(it)) + '</b><span>' + esc(lineDesc(l)) + '</span></div><div class="r"><b>' + eur(lineTotal(l)) + '</b><div class="ctl"><button data-act="lq" data-v="' + l.uid + '" data-d="-1">−</button><span class="b" style="font-size:40px">' + l.qty +
    '</span><button data-act="lq" data-v="' + l.uid + '" data-d="1">+</button><button class="rm" data-act="lrm" data-v="' + l.uid + '">' + t("rm") + "</button></div></div></div>"; }).join("");
  return '<div class="page"><h2>' + t("cart") + '</h2><div class="sub">' + cartCount(S.cart) + " " + t("items") + "</div>" +
    (hint ? '<div class="combo-hint"><span>' + t("combo") + " " + eur(hint.save) + "! (" + esc(nm(hint.combo)) + ")</span><button data-act=\"makeCombo\">" + t("makeCombo") + "</button></div>" : "") +
    '<div class="lines">' + (lines || '<p style="font:700 40px DM Sans;text-align:center;padding:100px">' + t("empty") + "</p>") + '</div><div class="sum"><div class="tr"><span>' + t("vat") + " 7 %</span><span>" + eur(tt.vat7) + '</span></div><div class="tr"><span>' + t("vat") + " 19 %</span><span>" + eur(tt.vat19) +
    '</span></div><div class="tot"><b>' + t("total") + '</b><span class="p">' + eur(tt.gross) + '</span></div><div class="acts"><button class="btn sec sm" data-act="toMenu">+ ' + t("more").replace("?", "") + '</button><button class="btn' + (S.cart.length ? "" : " dis") + '" data-act="toPay">' + t("pay") + "</button></div></div></div>";
}
function vPay(){
  return '<div class="page"><h2>' + t("pay") + '</h2><div class="sub">' + t("total") + " " + eur(totals(S.cart).gross) + '</div><div class="pay"><button class="paybtn" data-act="payCard"><span class="ico">💳</span><span><b>' + t("card") + "</b><span>" + t("cardS") + '</span></span></button>' +
    '<button class="paybtn" data-act="payCash"><span class="ico">🪙</span><span><b>' + t("cash") + "</b><span>" + t("cashS") + '</span></span></button></div><div class="sum"><div class="acts"><button class="ghost" style="color:#1A0A0A" data-act="back3">' + t("back") + "</button></div></div></div>";
}
function receipt(o){
  var p = function(s, n){ s = String(s); while (s.length < n) s += " "; return s.slice(0, n); }, r = function(s, n){ s = String(s); while (s.length < n) s = " " + s; return s; };
  var out = "BAM BIRD\n[Betreibergesellschaft, Adresse, USt-IdNr.]\n" + new Date(o.created_at).toLocaleString("de-DE") + "\nBestellung " + o.number + (o.mode === "here" ? "  Hier essen" : "  Mitnehmen") + "\n------------------------------\n";
  o.lines.forEach(function(l){ out += p(l.qty + "x " + l.name, 22) + r(eur(l.line_total).replace(" ", ""), 8) + "\n"; });
  out += "------------------------------\n" + p("GESAMT", 22) + r(eur(o.totals.gross).replace(" ", ""), 8) + "\nMwSt 7%  " + eur(o.totals.vat7).replace(" ", "") + "   MwSt 19% " + eur(o.totals.vat19).replace(" ", "") + "\n" + (o.payment.method === "card" ? "Bezahlt mit Karte" : "ZAHLUNG OFFEN, bitte an der Kasse") + "\nTSE: [Seriennummer, Signatur, Transaktion]\n";
  return out;
}
function vDone(){
  var o = S.last;
  return '<div class="done"><img src="assets/stack_weiss.svg" style="width:300px" alt=""><h2>' + (o.payment.method === "card" ? t("paid") : t("cashDue")) + '</h2><div class="m" style="font-size:34px">' + t("number") + '</div><div class="nr">' + o.number + '</div><p>' + t("ready") + "</p><p style=\"font-weight:500;font-size:34px\">" + t("readyS") + '</p><div class="receipt">' + esc(receipt(o)) + '</div><button class="btn" data-act="newOrder">' + t("newOrder") + "</button></div>";
}
function vDlg(){
  var d = S.dlg;
  if (d.type === "idle") return '<div class="scrim"></div><div class="dlg"><h3>' + t("still") + "</h3><p>" + t("stillS") + ' (<span id="idl">' + d.left + '</span>)</p><div class="acts"><button class="btn" data-act="idleYes">' + t("yes") + "</button></div></div>";
  if (d.type === "afilter") return '<div class="scrim" data-act="closeDlg"></div><div class="dlg"><h3>' + t("filterT") + '</h3><p>' + t("filterS") + '</p><div class="afilter">' + Object.keys(M.allergens).map(function(n){
    return '<button class="' + (S.filter.indexOf(n) > -1 ? "on" : "") + '" data-act="ftoggle" data-v="' + n + '">' + M.short[n] + "</button>"; }).join("") + '</div><div class="acts"><button class="btn" data-act="closeDlg">' + t("ok") + "</button></div></div>";
  if (d.type === "pin") return '<div class="scrim" data-act="closeDlg"></div><div class="dlg"><h3>Personal</h3><p>PIN: ' + "●".repeat(d.v.length) + "○".repeat(Math.max(0, 4 - d.v.length)) + '</p><div class="pin">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, "×", 0, "OK"].map(function(k){ return '<button data-act="pin" data-v="' + k + '">' + k + "</button>"; }).join("") + "</div></div>";
  if (d.type === "admin"){ var so = soldOut(); return '<div class="scrim" data-act="closeDlg"></div><div class="dlg" style="max-height:1500px;overflow:auto"><h3>Ausverkauft</h3><p>Tippen schaltet einen Artikel ab oder wieder an.</p><div class="afilter">' + M.items.map(function(i){
    return '<button class="' + (so.indexOf(i.id) > -1 ? "on" : "") + '" data-act="sold" data-v="' + i.id + '">' + esc(i.name) + "</button>"; }).join("") + '</div><div class="acts"><button class="btn sm" data-act="closeDlg">Fertig</button><a class="btn sm sec" href="?view=kds" target="_blank" style="text-decoration:none">Küchenmonitor</a></div></div>'; }
  return "";
}

/* ---------------- Attract Video (hin und zurück, Bild für Bild) ---------------- */
var attract = {raf: 0, loaded: false, t0: 0};
function startAttract(){
  var v = document.getElementById("av"); if (!v || attract.raf) return;
  if (!attract.url){
    fetch("assets/attract.mp4").then(function(r){ return r.blob(); }).then(function(b){ attract.url = URL.createObjectURL(b); var vv = document.getElementById("av"); if (vv) vv.src = attract.url; }).catch(function(){});
  } else v.src = attract.url;
  attract.t0 = performance.now();
  (function loop(){ var vv = document.getElementById("av"); if (!vv){ attract.raf = 0; return; }
    if (vv.duration){ var x = ((performance.now() - attract.t0) / 1000) % 10; x = x < 5 ? x / 5 : 2 - x / 5; var e = x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; vv.currentTime = Math.min(vv.duration - .05, e * vv.duration); }
    attract.raf = requestAnimationFrame(loop); })();
}
function stopAttract(){ if (S.screen !== "attract" && attract.raf){ cancelAnimationFrame(attract.raf); attract.raf = 0; } }

/* ---------------- Leerlauf: 60 s ohne Eingabe, 15 s Warnung, dann Start ---------------- */
var idle = {a: 0, b: 0};
function resetIdle(){
  clearTimeout(idle.a); clearInterval(idle.b); if (S.dlg && S.dlg.type === "idle"){ S.dlg = null; render(); }
  if (S.screen === "attract" || VIEW !== "kiosk") return;
  if (S.screen === "done") return;
  idle.a = setTimeout(function(){
    S.dlg = {type: "idle", left: R.idle_warning_seconds}; render();
    idle.b = setInterval(function(){ if (!S.dlg || S.dlg.type !== "idle"){ clearInterval(idle.b); return; } S.dlg.left--; var el = document.getElementById("idl"); if (el) el.textContent = S.dlg.left; if (S.dlg.left <= 0){ clearInterval(idle.b); reset(); } }, 1000);
  }, R.idle_seconds * 1000);
}
function reset(){ S.screen = "attract"; S.cart = []; S.mode = null; S.sheet = null; S.dlg = null; S.cat = "Combos"; S.filter = []; S.access = false; S.payment = null; render(); }
var doneT = 0;

/* ---------------- Aktionen ---------------- */
function newLine(id){ var it = ITEMS[id], l = {id: id, qty: 1, dips: {}, extra: {}, without: []}; if (it.drink_choice) l.drink = null; return l; }
function flyTo(srcEl){
  try { var img = srcEl && srcEl.querySelector("img"); if (!img) return; var r = img.getBoundingClientRect(), sc = stage.getBoundingClientRect().width / 1080, f = document.createElement("img");
    f.src = img.src; f.className = "fly"; f.style.left = (r.left - stage.getBoundingClientRect().left) / sc + "px"; f.style.top = (r.top - stage.getBoundingClientRect().top) / sc + "px"; app.appendChild(f);
    requestAnimationFrame(function(){ f.style.left = "120px"; f.style.top = "1780px"; f.style.width = "50px"; f.style.height = "50px"; f.style.opacity = ".3"; }); setTimeout(function(){ f.remove(); }, 650); } catch(e){}
}
var ACT = {
  start: function(){ S.screen = "mode"; },
  lang: function(v){ S.lang = v; },
  access: function(){ S.access = !S.access; },
  mode: function(v){ S.mode = v; S.screen = "menu"; },
  cat: function(v){ S.cat = v; S._scroll = 0; },
  open: function(v){ var it = ITEMS[v]; if (sold(it) || !it.available) return; var l = newLine(v);
    // Artikel ohne Optionen: direkt in den Warenkorb (Dips, Fries, Getränke ohne Wahl), sonst Sheet
    var needs = it.dips_included || it.drink_choice || it.without || it.extra_dips;
    if (!needs && !contains(it, S.filter).length){ addLine(l); S._fly = true; toast((S.lang === "en" ? "Added: " : "Hinzugefügt: ") + nm(it)); return; }
    S.sheet = {l: l}; },
  closeSheet: function(){ S.sheet = null; },
  qty: function(v, d){ var l = S.sheet.l; l.qty = Math.max(1, Math.min(R.max_qty, l.qty + (+d))); },
  dip: function(v, d){ var l = S.sheet.l, n = (l.dips[v] || 0) + (+d); if (n < 0) return; if (+d > 0 && dipsCount(l) >= dipsIncl(l)) return; if (n === 0) delete l.dips[v]; else l.dips[v] = n; },
  xdip: function(v, d){ var l = S.sheet.l, n = (l.extra[v] || 0) + (+d); if (n < 0 || n > 6) return; if (n === 0) delete l.extra[v]; else l.extra[v] = n; },
  drink: function(v){ S.sheet.l.drink = v; },
  without: function(v){ var w = S.sheet.l.without, i = w.indexOf(v); if (i > -1) w.splice(i, 1); else w.push(v); },
  addToCart: function(){ var l = S.sheet.l; if (!lineComplete(l)) return;
    var c = contains(ITEMS[l.id], S.filter); S.sheet = null; if (addLine(l)) toast((S.lang === "en" ? "Added: " : "Hinzugefügt: ") + nm(ITEMS[l.id])); },
  toUpsell: function(){ if (!S.cart.length) return; S.screen = upsell().length ? "upsell" : "cart"; },
  back: function(){ if (S.cart.length){ S.dlg = null; } S.screen = "mode"; },
  back2: function(){ S.screen = "menu"; }, back3: function(){ S.screen = "cart"; },
  toCart: function(){ S.screen = "cart"; }, toMenu: function(){ S.screen = "menu"; },
  lq: function(v, d){ var l = S.cart.filter(function(x){ return String(x.uid) === v; })[0]; if (!l) return; l.qty += +d; if (l.qty < 1) S.cart = S.cart.filter(function(x){ return x !== l; }); l && (l.qty = Math.min(R.max_qty, l.qty)); },
  lrm: function(v){ S.cart = S.cart.filter(function(x){ return String(x.uid) !== v; }); },
  makeCombo: function(){ var h = comboHint(); if (!h) return; var l = newLine(h.combo.id); l.drink = h.combo.drink_choice ? (h.drink.id === "limo-pink" || h.drink.id === "limo-gelb" || h.drink.id === "cola" || h.drink.id === "wasser" ? h.drink.id : "cola") : null;
    S.cart = S.cart.filter(function(x){ return x !== h.burger && x !== h.fries && x !== h.drink; }); addLine(l); toast(nm(h.combo) + " ✓"); },
  toPay: function(){ if (cartTotal(S.cart) > R.staff_call_total){ toast(t("staff")); } S.screen = "pay"; },
  payCard: function(){ S.screen = "wait"; render(); setTimeout(function(){ finish("card"); }, 2600); return true; },
  payCash: function(){ finish("cash"); return true; },
  newOrder: function(){ reset(); },
  logo: function(){ },
  afilter: function(){ S.dlg = {type: "afilter"}; }, ftoggle: function(v){ var i = S.filter.indexOf(v); if (i > -1) S.filter.splice(i, 1); else S.filter.push(v); },
  closeDlg: function(){ S.dlg = null; },
  idleYes: function(){ S.dlg = null; },
  pin: function(v){ var d = S.dlg; if (v === "×"){ d.v = d.v.slice(0, -1); } else if (v === "OK"){ if (d.v === "1234") S.dlg = {type: "admin"}; else { d.v = ""; toast("PIN falsch"); } } else if (d.v.length < 4){ d.v += v; if (d.v.length === 4 && d.v === "1234") S.dlg = {type: "admin"}; } },
  sold: function(v){ var a = soldOut(), i = a.indexOf(v); if (i > -1) a.splice(i, 1); else a.push(v); setSold(a); }
};
function finish(method){
  S.last = placeOrder(method); S.screen = "done"; S.cart = []; render();
  clearTimeout(doneT); doneT = setTimeout(reset, R.done_reset_seconds * 1000);
}
document.addEventListener("click", function(e){
  if (VIEW !== "kiosk") return;
  var b = e.target.closest("[data-act]"); if (!b) return; var act = b.getAttribute("data-act"); if (!ACT[act]) return;
  var g = app.querySelector(".grid"); S._scroll = g ? g.scrollTop : null;
  var src = b.classList.contains("card") ? b : null;
  var before = S.cart.length + "/" + cartCount(S.cart);
  var skip = ACT[act](b.getAttribute("data-v"), b.getAttribute("data-d"));
  resetIdle(); if (skip) return; render();
  if (S._fly && src){ S._fly = false; flyTo(src); }
});
/* Logo lange drücken (2 s): Personalbereich mit PIN */
var press = 0;
document.addEventListener("pointerdown", function(e){ if (VIEW !== "kiosk") return; resetIdle(); var l = e.target.closest('[data-act="logo"]'); if (l){ press = setTimeout(function(){ S.dlg = {type: "pin", v: ""}; render(); }, 2000); } });
document.addEventListener("pointerup", function(){ clearTimeout(press); }); document.addEventListener("pointermove", resetIdle);

/* ---------------- Küchenmonitor und Abholmonitor ---------------- */
var STN = {burger: "Burger", fry: "Fritteuse", bar: "Getränke und Dips"};
function mins(o){ return Math.floor((Date.now() - new Date(o.created_at)) / 60000); }
function kdsTicket(o){
  var late = mins(o) >= 8 && o.status !== "ready";
  var lines = ["burger", "fry", "bar"].map(function(st){ var ls = o.lines.filter(function(l){ return l.station === st; }); if (!ls.length) return ""; return ls.map(function(l){
    var det = []; Object.keys(l.options.dips).forEach(function(k){ det.push(l.options.dips[k] + "× " + ITEMS[k].name); }); Object.keys(l.options.extra_dips).forEach(function(k){ det.push("+" + l.options.extra_dips[k] + "× " + ITEMS[k].name); });
    if (l.options.drink) det.push(ITEMS[l.options.drink].name); if (l.options.without.length) det.push("OHNE " + l.options.without.join(", "));
    return '<div class="li"><span class="st-tag">' + STN[st] + "</span>" + l.qty + "× " + esc(l.name) + (det.length ? "<small>" + esc(det.join(" · ")) + "</small>" : "") + "</div>"; }).join(""); }).join("");
  var btn = {awaiting_payment: '<button class="y" data-k="paid" data-id="' + o.id + '">Bezahlt markieren</button>', "new": '<button data-k="prep" data-id="' + o.id + '">In Arbeit</button>', prep: '<button class="g" data-k="ready" data-id="' + o.id + '">Fertig, Nummer rufen</button>', ready: '<button class="g" data-k="done" data-id="' + o.id + '">Abgeholt</button>'}[o.status] || "";
  return '<div class="tk' + (o.status === "awaiting_payment" ? " cash" : "") + (late ? " late" : "") + '"><div class="h"><b>' + o.number + "</b><span>" + mins(o) + " min · " + eur(o.totals.gross) + '</span></div><div class="md">' + (o.mode === "here" ? "Hier essen" : "Mitnehmen") + " · " + (o.payment.method === "card" ? "Karte" : "Bar") + "</div>" + lines + '<div class="btns">' + btn + "</div></div>";
}
function renderKDS(){
  var all = db(), col = function(st){ return all.filter(function(o){ return o.status === st; }); };
  var today = all.filter(function(o){ return o.status !== "awaiting_payment"; }), sum = today.reduce(function(a, o){ return a + o.totals.gross; }, 0), so = soldOut();
  app.innerHTML = '<div class="kds-top"><img src="assets/line_weiss.svg" alt=""><h1>Küchenmonitor</h1><span class="st">' + all.length + " Bestellungen · " + eur(sum) + ' Umsatz heute</span><button data-k="clear">Tag zurücksetzen</button></div><div class="kds-cols">' +
    [["awaiting_payment", "Zahlung offen (Bar)"], ["new", "Neu"], ["prep", "In Arbeit"], ["ready", "Fertig"]].map(function(c){ return '<div class="kds-col"><h2>' + c[1] + " (" + col(c[0]).length + ")</h2>" + col(c[0]).map(kdsTicket).join("") + "</div>"; }).join("") +
    '</div><div class="kds-side"><h2>Ausverkauft (86)</h2><div class="sold">' + M.items.map(function(i){ return '<button class="' + (so.indexOf(i.id) > -1 ? "off" : "") + '" data-k="sold" data-id="' + i.id + '">' + esc(i.name) + "</button>"; }).join("") + "</div></div>";
}
function renderReady(){
  var all = db(), r = all.filter(function(o){ return o.status === "ready"; }), w = all.filter(function(o){ return o.status === "new" || o.status === "prep"; });
  app.innerHTML = '<div class="kds-top"><img src="assets/line_weiss.svg" alt=""><h1>Abholung</h1></div><div class="ready"><div class="a"><h2>Fertig, BAM!</h2>' + r.map(function(o){ return '<span class="num">' + o.number + "</span>"; }).join("") + '</div><div class="w"><h2>In Arbeit</h2>' + w.map(function(o){ return '<span class="num">' + o.number + "</span>"; }).join("") + "</div></div>";
}
function kdsClick(e){
  var b = e.target.closest("[data-k]"); if (!b) return; var k = b.getAttribute("data-k"), id = b.getAttribute("data-id");
  if (k === "paid") advance(id, "new"); else if (k === "prep") advance(id, "prep"); else if (k === "ready"){ advance(id, "ready"); try { speechSynthesis.speak(new SpeechSynthesisUtterance("Bam!")); } catch(x){} } else if (k === "done") advance(id, "done");
  else if (k === "sold"){ var a = soldOut(), i = a.indexOf(id); if (i > -1) a.splice(i, 1); else a.push(id); setSold(a); } else if (k === "clear"){ if (confirm("Alle Bestellungen von heute löschen?")){ save([]); localStorage.removeItem("bb-seq"); } }
  renderKDS();
}

/* ---------------- Start ---------------- */
function fit(){ if (VIEW !== "kiosk") return; var s = Math.min(innerWidth / 1080, innerHeight / 1920); stage.style.transform = "scale(" + s + ")"; stage.style.marginLeft = ((innerWidth - 1080 * s) / 2) + "px"; stage.style.marginTop = ((innerHeight - 1920 * s) / 2) + "px"; }
if (VIEW === "kds"){ document.body.className = "view-kds"; renderKDS(); document.addEventListener("click", kdsClick); setInterval(renderKDS, 15000); if (bc) bc.onmessage = renderKDS; window.addEventListener("storage", renderKDS); }
else if (VIEW === "ready"){ document.body.className = "view-ready"; renderReady(); setInterval(renderReady, 5000); if (bc) bc.onmessage = renderReady; window.addEventListener("storage", renderReady); }
else { addEventListener("resize", fit); fit(); render(); if (bc) bc.onmessage = function(m){ if (m.data === "sold") render(); }; }
window.BB = {S: S, ACT: ACT, totals: totals, cart: function(){ return S.cart; }, render: render, ITEMS: ITEMS, upsell: upsell, comboHint: comboHint, lineTotal: lineTotal, vatSplit: vatSplit, addLine: addLine, newLine: newLine, lineComplete: lineComplete};
})();

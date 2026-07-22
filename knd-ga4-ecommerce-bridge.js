/* KND Cafe24 -> GA4 ecommerce bridge. Loaded via Cafe24 scripttag. */
(function () {
  'use strict';
  var GA4_ID = 'G-TYDY8XMCHB';
  var META_PIXEL_ID = '202253855746154';
  var sent = {};

  function once(key, fn) {
    if (sent[key]) return;
    sent[key] = true;
    try { fn(); } catch (e) { console.warn('[KND GA4 bridge]', e); }
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function loadGA4() {
    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + GA4_ID + '"]')) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
      (document.head || document.documentElement).appendChild(s);
    }
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { send_page_view: true });
  }

  function num(v) {
    if (v == null) return 0;
    var n = String(v).replace(/[^0-9.\-]/g, '');
    return Number(n || 0) || 0;
  }

  function itemFromGlobals() {
    var id = window.iProductNo || '';
    var name = window.product_name || document.querySelector('meta[property="og:title"]')?.content || document.title || '';
    var price = num(window.product_sale_price || window.product_price || document.querySelector('#span_product_price_text')?.textContent);
    return { item_id: String(id || name), item_name: String(name), price: price, quantity: 1 };
  }

  function send(name, params) {
    params = params || {};
    params.currency = params.currency || 'KRW';
    window.gtag('event', name, params);
  }

  function mapFbqEvent(ev, params) {
    params = params || {};
    var contents = Array.isArray(params.contents) ? params.contents : [];
    var items = contents.map(function (c) {
      return {
        item_id: String(c.id || c.content_id || c.variant_code || ''),
        item_name: String(c.title || c.name || c.id || ''),
        price: num(c.item_price || c.price),
        quantity: num(c.quantity || 1) || 1
      };
    }).filter(function (x) { return x.item_id || x.item_name; });
    if (!items.length && (ev === 'ViewContent' || ev === 'AddToCart')) items = [itemFromGlobals()];
    var payload = { currency: params.currency || 'KRW', value: num(params.value || params.total_price), items: items };
    if (params.event_id) payload.transaction_id = String(params.event_id);
    if (ev === 'ViewContent') {
      var first = payload.items && payload.items[0];
      once('view_item_' + (first && first.item_id || location.pathname), function () { send('view_item', payload); });
    }
    if (ev === 'AddToCart') send('add_to_cart', payload);
    if (ev === 'InitiateCheckout') send('begin_checkout', payload);
    if (ev === 'Purchase') {
      payload.transaction_id = payload.transaction_id || String(params.order_id || params.order_no || Date.now());
      send('purchase', payload);
    }
  }

  function handleFbqArgs(args) {
    var a = Array.prototype.slice.call(args || []);
    var cmd = a[0], ev, params;
    if (cmd === 'track') { ev = a[1]; params = a[2] || {}; }
    if (cmd === 'trackSingle') { if (a[1] !== META_PIXEL_ID) return; ev = a[2]; params = a[3] || {}; }
    if (ev) mapFbqEvent(ev, params);
  }

  function wrapFbq() {
    var old = window.fbq;
    if (!old || old.__kndGa4Wrapped) return false;
    try {
      if (old.queue && old.queue.length) old.queue.forEach(handleFbqArgs);
    } catch (e) {}
    var wrapped = function () {
      handleFbqArgs(arguments);
      return old.apply(this, arguments);
    };
    for (var k in old) { try { wrapped[k] = old[k]; } catch (e) {} }
    wrapped.__kndGa4Wrapped = true;
    window.fbq = wrapped;
    return true;
  }

  function bindCafe24Basket() {
    var jq = window.EC$ || window.jQuery || window.$;
    if (!jq || !jq('body').bind) return false;
    jq('body').bind('EC_PRODUCT_ACTION_BASKET', function (e, params) {
      params = params || {};
      var contents = params.contents || [];
      send('add_to_cart', {
        currency: 'KRW',
        value: num(params.total_price),
        items: contents.map(function (c) {
          return {
            item_id: String(params.product_no || c.id || c.variant_code || ''),
            item_name: String(window.product_name || ''),
            price: num(c.price),
            quantity: num(c.quantity || 1) || 1
          };
        })
      });
    });
    return true;
  }

  function pageEvents() {
    var path = location.pathname;
    if (/\/product\//.test(path) && window.iProductNo) {
      once('view_item_' + window.iProductNo, function () {
        var item = itemFromGlobals();
        send('view_item', { currency: 'KRW', value: item.price, items: [item] });
      });
    }
    if (/\/order\/(basket|orderform|order_form)/.test(path)) {
      once('begin_checkout_' + path, function () { send('begin_checkout', { currency: 'KRW' }); });
    }
  }

  loadGA4();
  pageEvents();
  wrapFbq();
  bindCafe24Basket();
  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    pageEvents();
    wrapFbq();
    bindCafe24Basket();
    if (tries > 20) clearInterval(timer);
  }, 500);
})();

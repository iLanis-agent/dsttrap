(function (root) {
  // Local-time trouble finder: which local clock times do not exist or happen twice in an IANA zone.
  var fmtCache = {};
  function fmt(zone) {
    if (!fmtCache[zone]) fmtCache[zone] = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    return fmtCache[zone];
  }
  function validZone(zone) { try { fmt(zone); return true; } catch (e) { return false; } }
  // offset in minutes east of UTC at an instant (ms since epoch)
  function offsetAt(zone, ms) {
    var p = {}; fmt(zone).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = +x.value; });
    var local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((local - Math.floor(ms / 1000) * 1000) / 60000);
  }
  function localParts(zone, ms) {
    var p = {}; fmt(zone).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = +x.value; });
    return p;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function offStr(m) { var s = m < 0 ? '-' : '+', a = Math.abs(m); return s + pad(Math.floor(a / 60)) + ':' + pad(a % 60); }
  // classify a wall-clock time (as if it were UTC fields) in a zone
  function classify(zone, y, mo, d, h, mi) {
    var wall = Date.UTC(y, mo - 1, d, h, mi, 0), seen = {}, hits = [], i, cands = [];
    [wall - 86400000, wall, wall + 86400000].forEach(function (t) { var o = offsetAt(zone, t); if (!seen[o]) { seen[o] = 1; cands.push(o); } });
    for (i = 0; i < cands.length; i++) { var utc = wall - cands[i] * 60000; if (offsetAt(zone, utc) === cands[i]) hits.push({ utc: utc, offset: cands[i] }); }
    hits.sort(function (a, b) { return a.utc - b.utc; });
    if (hits.length === 1) return { kind: 'ok', instants: hits };
    if (hits.length >= 2) return { kind: 'ambiguous', instants: hits };
    // gap: the two readings, using the offset before and after the jump
    var sorted = cands.slice().sort(function (a, b) { return a - b; });
    var before = offsetAt(zone, wall - 86400000 - sorted[0] * 60000), after = offsetAt(zone, wall + 86400000 - sorted[0] * 60000);
    var readings = [before, after].map(function (o) { return { utc: wall - o * 60000, offset: o }; });
    return { kind: 'gap', instants: [], readings: readings, shiftedTo: wall - before * 60000 + 0 };
  }
  // transitions in a calendar year (UTC bounds), found by a 6-hour scan then bisecting to the minute
  function transitions(zone, year) {
    var start = Date.UTC(year, 0, 1) - 6 * 3600000, end = Date.UTC(year + 1, 0, 1), out = [], t = start, prev = offsetAt(zone, t), step = 6 * 3600000;
    while (t < end) {
      var n = t + step, o = offsetAt(zone, n);
      if (o !== prev) {
        var lo = t, hi = n; while (hi - lo > 60000) { var mid = lo + Math.floor((hi - lo) / 120000) * 60000; if (mid <= lo) mid = lo + 60000; if (offsetAt(zone, mid) === prev) lo = mid; else hi = mid; }
        if (hi >= Date.UTC(year, 0, 1) && hi < end) out.push({ utc: hi, from: prev, to: o, deltaMin: o - prev });
        prev = o;
      }
      t = n;
    }
    out.forEach(function (x) { x.localBefore = localParts(zone, x.utc - 60000); x.localAfter = localParts(zone, x.utc); });
    return out;
  }
  // for a daily job at h:mi local, the days (in a year) it is skipped or runs twice
  function dailyJob(zone, year, h, mi) {
    var res = [];
    transitions(zone, year).forEach(function (tr) {
      var days = {};
      [tr.localBefore, tr.localAfter].forEach(function (p) { days[p.year + '-' + pad(p.month) + '-' + pad(p.day)] = [p.year, p.month, p.day]; });
      Object.keys(days).forEach(function (k) {
        var d = days[k], c = classify(zone, d[0], d[1], d[2], h, mi);
        if (c.kind !== 'ok') res.push({ date: k, kind: c.kind, transition: tr, detail: c });
      });
    });
    return res;
  }
  var api = { validZone: validZone, offsetAt: offsetAt, classify: classify, transitions: transitions, dailyJob: dailyJob, offStr: offStr, localParts: localParts, pad: pad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DstTrap = api;
})(typeof window !== 'undefined' ? window : this);

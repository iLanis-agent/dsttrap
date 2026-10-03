var D = require('./engine.js'); var fails = 0, n = 0;
function eq(a, b, m) { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', m, JSON.stringify(a), JSON.stringify(b)); } }
// Independent oracle: Intl "longOffset" strings scanned every hour, and a brute-force count of how often each local minute appears across a transition day.
function oracleOffset(zone, ms) {
  var s = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).filter(function (x) { return x.type === 'timeZoneName'; })[0].value;
  var m = /GMT([+-])(\d\d):(\d\d)/.exec(s); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}
function oracleTransitions(zone, year) {
  var out = [], t = Date.UTC(year, 0, 1) - 3600000, end = Date.UTC(year + 1, 0, 1), prev = oracleOffset(zone, t);
  for (; t < end; t += 3600000) { var o = oracleOffset(zone, t + 3600000); if (o !== prev) { out.push({ hourStart: t, from: prev, to: o }); prev = o; } }
  return out.filter(function (x) { return x.hourStart + 3600000 >= Date.UTC(year, 0, 1); });
}
var P = new Intl.DateTimeFormat('en-US', { hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: 'UTC' });
function key(ms) { return P.format(new Date(ms)); }
var zones = ['America/New_York', 'America/Los_Angeles', 'America/St_Johns', 'Europe/London', 'Europe/Berlin', 'Asia/Jerusalem', 'Australia/Sydney', 'Australia/Lord_Howe', 'Pacific/Auckland', 'Pacific/Chatham', 'Africa/Casablanca', 'Asia/Kolkata', 'Asia/Tokyo', 'America/Sao_Paulo', 'UTC', 'Africa/Cairo'];
zones.forEach(function (z) {
  [2024, 2025].forEach(function (y) {
    var mine = D.transitions(z, y), orc = oracleTransitions(z, y);
    eq(mine.length, orc.length, 'transition count ' + z + y);
    mine.forEach(function (tr, i) {
      var o = orc[i]; if (!o) return;
      eq([tr.from, tr.to], [o.from, o.to], 'offsets ' + z + y + '#' + i);
      eq(tr.utc >= o.hourStart && tr.utc <= o.hourStart + 3600000 && tr.utc % 60000 === 0, true, 'instant inside oracle hour ' + z + y);
      eq(oracleOffset(z, tr.utc - 60000), tr.from, 'offset just before ' + z); eq(oracleOffset(z, tr.utc), tr.to, 'offset at transition ' + z);
      // brute force: how many UTC minutes in +-3h map to each local minute
      var counts = {}, m; for (m = tr.utc - 3 * 3600000; m < tr.utc + 3 * 3600000; m += 60000) { var lm = m + oracleOffset(z, m) * 60000; counts[lm] = (counts[lm] || 0) + 1; }
      var lmStart = tr.utc - 3 * 3600000 + oracleOffset(z, tr.utc - 3 * 3600000) * 60000, lmEnd = tr.utc + 3 * 3600000 + oracleOffset(z, tr.utc + 3 * 3600000) * 60000;
      var lo = Math.min(lmStart, lmEnd), hi = Math.max(lmStart, lmEnd);
      for (var l = lo + 3600000; l < hi - 3600000; l += 60000) {
        var d = new Date(l), c = D.classify(z, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()), expect = counts[l] || 0;
        eq(c.kind, expect === 0 ? 'gap' : expect === 1 ? 'ok' : 'ambiguous', 'classify ' + z + ' ' + d.toISOString());
        if (c.kind !== 'gap') eq(c.instants.length, expect, 'instants ' + z);
      }
    });
  });
});
// anchors from the Wikipedia DST in the United States page: 2nd Sunday of March 2:00 -> 3:00, 1st Sunday of November 2:00 -> 1:00
eq(D.classify('America/New_York', 2024, 3, 10, 2, 30).kind, 'gap', 'NY 2024-03-10 02:30 does not exist'); eq(D.classify('America/New_York', 2024, 3, 10, 1, 59).kind, 'ok', '01:59 fine'); eq(D.classify('America/New_York', 2024, 3, 10, 3, 0).kind, 'ok', '03:00 fine');
eq(D.classify('America/New_York', 2024, 11, 3, 1, 30).kind, 'ambiguous', 'NY 2024-11-03 01:30 twice'); eq(D.classify('America/New_York', 2024, 11, 3, 2, 0).kind, 'ok', '02:00 fine after'); eq(D.classify('America/New_York', 2024, 11, 3, 0, 59).kind, 'ok', '00:59 fine');
eq(D.classify('America/New_York', 2024, 11, 3, 1, 30).instants.map(function (i) { return i.offset; }), [-240, -300], 'EDT then EST');
eq(D.transitions('America/New_York', 2025).map(function (t) { return new Date(t.utc).toISOString(); }), ['2025-03-09T07:00:00.000Z', '2025-11-02T06:00:00.000Z'], 'US 2025 dates (2nd Sun Mar, 1st Sun Nov)');
// Lord Howe: standard +10:30, DST +11, so the jump is 30 minutes
eq(D.transitions('Australia/Lord_Howe', 2024).map(function (t) { return [t.from, t.to]; }), [[660, 630], [630, 660]], 'Lord Howe 30 min shifts'); eq(D.classify('Australia/Lord_Howe', 2024, 10, 6, 2, 15).kind, 'gap', 'Lord Howe gap 02:15'); eq(D.classify('Australia/Lord_Howe', 2024, 10, 6, 2, 45).kind, 'ok', 'Lord Howe 02:45 fine');
eq(D.classify('Australia/Lord_Howe', 2024, 4, 7, 1, 45).kind, 'ambiguous', 'Lord Howe overlap 01:45'); eq(D.classify('Australia/Lord_Howe', 2024, 4, 7, 1, 15).kind, 'ok', 'Lord Howe 01:15 fine');
// zones without DST never trouble
eq(D.transitions('Asia/Tokyo', 2024), [], 'Tokyo none'); eq(D.dailyJob('Asia/Kolkata', 2024, 2, 30), [], 'Kolkata none'); eq(D.validZone('Nope/Zone'), false, 'bad zone'); eq(D.validZone('Europe/Paris'), true, 'good zone');
// daily job
eq(D.dailyJob('Europe/Berlin', 2024, 2, 30).map(function (x) { return x.date + ' ' + x.kind; }), ['2024-03-31 gap', '2024-10-27 ambiguous'], 'Berlin 02:30 job'); eq(D.dailyJob('Europe/Berlin', 2024, 12, 0), [], 'noon job safe'); eq(D.dailyJob('America/New_York', 2024, 2, 0).map(function (x) { return x.date + ' ' + x.kind; }), ['2024-03-10 gap'], 'NY 02:00 job: skipped in March only');
eq(D.dailyJob('America/New_York', 2024, 1, 30).map(function (x) { return x.kind; }), ['ambiguous'], 'NY 01:30 only doubles'); eq(D.dailyJob('America/New_York', 2024, 2, 30).map(function (x) { return x.kind; }), ['gap'], 'NY 02:30 only skipped');
console.log(n + ' checks, ' + fails + ' failures'); process.exit(fails ? 1 : 0);

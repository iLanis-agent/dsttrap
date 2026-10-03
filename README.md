# DstTrap

Daylight saving trap finder. Pick an IANA time zone, a date and a local time: it says whether that wall-clock time exists once, does not exist (clocks skip it) or happens twice, with the exact UTC instants. It also lists every day of the year on which a daily job at that time is skipped or ambiguous, and all clock changes in that year.

- Live: https://ilanis-agent.github.io/dsttrap/
- App: https://ilanis-agent.github.io/dsttrap/app.html

Sources: Wikipedia "Daylight saving time in the United States" (fetched directly: changes at 2:00 a.m. local, second Sunday in March, first Sunday in November, 2:00 to 3:00 and 2:00 to 1:00) and Wikipedia "Lord Howe Island" (standard time UTC+10:30, UTC+11 with DST; fetched directly). Zone data comes from the browser's Intl time zone database.
Oracle: an independent method in the tests (Intl "longOffset" strings scanned hourly, and a brute-force count of how many UTC minutes map to each local minute around every transition) over 16 zones for 2024 and 2025. Not verified: that a given scheduler (cron, cloud schedulers) treats a skipped or doubled time the way the "readings" suggest; behaviour differs by system. The engine and the oracle both read the same browser tz database, so tzdata mistakes would not be caught.

Tests: `node test-engine.js` (21906 checks, about 20 seconds).

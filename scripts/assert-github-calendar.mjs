import { parseContributionCalendarHtml } from "./github-contribution-calendar.mjs";

const fixture = `
<td tabindex="0" data-date="2025-09-05" id="contribution-day-component-5-0" class="ContributionCalendar-day"></td>
<tool-tip for="contribution-day-component-5-0">No contributions on September 5th.</tool-tip>
<td tabindex="0" data-ix="52" data-date="2026-09-04" id="contribution-day-component-5-52" data-level="4" role="gridcell" class="ContributionCalendar-day"></td>
<tool-tip for="contribution-day-component-5-52">58 contributions on September 4th.</tool-tip>
<td tabindex="0" data-date="2026-09-05" id="contribution-day-component-6-52" data-level="1" class="ContributionCalendar-day"></td>
<tool-tip for="contribution-day-component-6-52">6 contributions on September 5th.</tool-tip>
<td class="ContributionCalendar-day" data-date="2026-09-03" id="contribution-day-component-x"></td>
<tool-tip for="contribution-day-component-x">1 contribution on September 3rd.</tool-tip>
`;

const days = parseContributionCalendarHtml(fixture);
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

if (days.get("2025-09-05") !== 0) fail(`2025-09-05 should be 0, got ${days.get("2025-09-05")}`);
if (days.get("2026-09-03") !== 1) fail(`2026-09-03 should be 1, got ${days.get("2026-09-03")}`);
if (days.get("2026-09-04") !== 58) fail(`2026-09-04 should be 58, got ${days.get("2026-09-04")}`);
if (days.get("2026-09-05") !== 6) fail(`2026-09-05 should be 6, got ${days.get("2026-09-05")}`);
if (days.size !== 4) fail(`expected 4 days, got ${days.size}`);

console.log("OK: public contribution calendar parser.");

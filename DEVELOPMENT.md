# On-Call — local development

Verified 2026-09-28: `dev/oncall` started clean at `5c879ee`, matching the remote `main` tip. Published base: v0.7.22. No publication or push has been performed.

## Current change

Maintenance Request preview now provides Previous / Next (Anterior / Siguiente), a position counter, and disabled controls at the beginning/end. It follows `eventsPeriod()`, including its chronological order and suppressed-report filtering. Refreshing the list clears a preview whose request is no longer in the active period. The navigation stays outside the printable paper and is hidden in print CSS.

Deferred preview adjustments now check the displayed event ID, preventing an earlier Mandatory request or blank Time Received callback from changing a newly opened request.

## Validation

- All app JavaScript files and the test script passed Node syntax checks; `git diff --check` passed.
- `tests/request-navigation.html` runs the real app against synthetic records on a fresh localhost origin. Serve the repository with a local HTTP server and open `/tests/request-navigation.html`. Use a fresh port if that origin contains On-Call data. The harness refuses existing data unless this tab previously established the synthetic test session.
- 15 browser checks passed: chronological order, period/report filtering, boundaries, previous/next, Mandatory layout, rapid navigation, Time Received, print-paper isolation, unchanged event/Payroll data while browsing, language labels, removals, single request, period changes, and empty state.
- Manually clicked Previous / Next at a 390px iframe width; controls fit and the final Next button is disabled. This is a narrow Chromium viewport check, not a physical iPhone/Safari test. The existing wide paper still scrolls horizontally in Chromium.
- Existing startup console issue observed: MutationObserver receives a missing node. It did not prevent these checks; investigate separately.
- Actual PDF output and installed iPhone behavior still require release validation. Version and cache identifiers remain v0.7.22 until a publication is agreed.

## Payroll improvements (local, unpublished)

- Added a top shortcut that generates the current Time Card preview. Return-to-Payroll controls are available after the day editor and both above and below the preview; they never enter the printed form. Period changes to an empty/different period clear the old preview.
- Replaced field-event Reconcile with a reversible reviewed check and direct Maintenance Request Edit. Linked event Edit also opens the Maintenance Request. + Event, + IN/OUT and Events / Split remain. Review metadata lives on the event; it does not change hours, snapshots or links, and is invalidated when event content or that day's Payroll blocks change. Closed periods block review changes.
- Increased filled-in dates/times, header values, signatures and red notes moderately without changing form widths/heights or labels. Styles are shared with the existing PDF handoff. Narrow non-iOS previews retain the full form width with horizontal overflow rather than squeezing columns; iOS keeps its existing scaled stage.
- 22 Payroll browser checks passed: shortcuts, review persistence/undo/invalidation, direct Edit, retained split/add controls, closed-period protection, language, empty periods, print isolation and font sizes. Test harness: `tests/payroll-workflow.html`, on a fresh local port (synthetic data only).
- Actual app PDF engine produced a **one-page US Letter portrait PDF** from 14 days with two blocks per day, a corrected time and a red Vacation note. Inspected the rendered PDF visually; dates, hours, header values, signature and note fit. Saved proof outside the repository in `../oncall-review/payroll-test.pdf` and `.png`. Physical iPhone/Safari and the native PC print dialog remain untested.

## Agreed work status

Recovered from the chat “On-Call Aplication”:

1. Payroll shortcuts: implemented locally.
2. Increase filled-in Time Card values: implemented locally; one-page PDF sample verified.
3. Simplify Reconcile: implemented locally; Humanity preserved.
4. Later: Snow, Pool and edge cases, followed by multiuser/cloud work.


## Maintenance Request materials

- Maintenance Request Edit now supports multiple Material / Part rows, each with its own quantity, Add Material, and row removal.
- Events store structured `materialItems` while retaining the first item in the legacy `material` / `quantity` fields for backward compatibility.
- Existing legacy requests open without data loss as one editable row. Once saved, they migrate to the structured list.
- The printable Maintenance Request renders every saved material on its own row and preserves at least the original six material lines.
- Field-entry emergencies still allow the existing single material input; that value is also stored as a one-item structured list.
- Local test harness: `tests/materials-workflow.html`. It covers legacy fallback, add/remove rows, persistence, compatibility fields, and printable rows.
- JavaScript syntax checks are required before release; physical browser/iPhone and printed-output validation remain release checks.

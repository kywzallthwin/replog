# Wave 1: Mobile Acceptance And Frontend Quality

This file is the canonical source for Wave 1 ticket definitions and states.
Tickets use the compact format below so normal implementation sessions do not
need a separate ticket file or a large process document.

## Ticket Order

1. `W1-01`: Establish the 375px mobile baseline
2. `W1-02`: Add the frontend test foundation
3. `W1-03`: Correct shared accessibility and interaction primitives
4. `W1-04`: Correct authentication and profile mobile issues
5. `W1-05`: Resolve dashboard behavior and loading decisions
6. `W1-06`: Correct shell, navigation, and dashboard mobile issues
7. `W1-07`: Correct program and exercise-picker mobile issues
8. `W1-08`: Correct active-workout mobile issues
9. `W1-09`: Correct history and progress mobile issues
10. `W1-10`: Add browser coverage and complete the Wave 1 gate

Allowed states: `proposed`, `ready`, `in progress`, `review`, `blocked`,
`done`.

## W1-01: Establish The 375px Mobile Baseline

**State:** done

### Goal

Audit the current application at the 375px acceptance width before changing
application code, then turn confirmed findings into small, measurable fixes.

### Scope

- Inspect every route exposed by `client/src/router.tsx` at 375px.
- Compare observable behavior with the mockup and build plan.
- Check loading, empty, populated, validation, API-error, long-content,
  menu, dialog, keyboard, navigation, overflow, focus, and touch-target
  states where they can be safely observed.
- Record confirmed findings, unobserved states, severity, references, and
  proposed follow-up tickets in this file.
- Refine the provisional Wave 1 tickets using the audit evidence.

### Out of scope

- Client or server application changes.
- Dependency, package, configuration, test, schema, or migration changes.
- Phase 4 or later product features.
- Production testing, deployment, or data changes.

### Acceptance criteria

- AC1: Every current client route is listed as observed or unobserved.
- AC2: Each confirmed finding has a route/state, evidence, severity, source
  reference, proposed ticket, and measurable acceptance condition.
- AC3: The audit distinguishes observed behavior from assumptions and states
  why any important state could not be observed.
- AC4: Only `WAVE1.md` and `STATUS.md` are changed by the audit ticket.
- AC5: No Phase 4 feature is added to the implementation scope.

### Verification

- Inspect the complete documentation diff.
- Run `git diff --check`.
- Confirm the local app was used rather than the production deployment.
- Confirm the audit was performed at exactly 375px when browser access is
  available.

### Stop conditions

- Stop if browser access or the local application is unavailable.
- Stop if authentication requires credentials that cannot be entered manually.
- Stop if the mockup and build plan conflict on a product decision.
- Stop if application, dependency, configuration, database, or production
  changes appear necessary.

## W1-02: Add The Frontend Test Foundation

**State:** done

### Goal

Add a lightweight client test runner and representative component tests so
Wave 1 fixes can be verified without depending on the real API.

### Scope

- Add the smallest suitable client test setup after W1-01 confirms the need.
- Add a client test script and integrate it with root verification.
- Add representative tests for a form and an auth/navigation boundary.
- Cover the confirmed baseline regressions: modal focus containment, profile
  field associations, and representative compact-control sizing.

### Out of scope

- Broad component coverage.
- Browser/E2E setup, which belongs to W1-10.
- Product behavior changes.
- Server test or API refactoring.

### Acceptance criteria

- AC1: The client has a repeatable non-interactive test command.
- AC2: Root `npm test` runs both client and server tests.
- AC3: Representative client tests pass without using production or a real
  database.
- AC4: Existing client and server lint, typecheck, and build behavior remains
  passing.
- AC5: Regression tests cover invalid-field focus and the shared dialog/menu
  keyboard contract without requiring a live API.

### Verification

- Run the client test command.
- Run `npm test`.
- Run `npm run lint -w client` and `npm run typecheck -w client`.
- Run the affected build checks.

### Stop conditions

- Stop if adding the test setup requires an unresolved tooling decision.
- Stop if package changes would affect server or production dependencies
  without explicit scope approval.

### W1-02 Implementation And Blocker Report

- Date: 2026-09-01.
- Test setup: Vitest with a jsdom environment, React Testing Library, and
  jest-dom matchers; the client script is `vitest run` and the root test script
  runs the client before the existing server test script.
- Coverage added: invalid registration-field focus, mocked authentication
  boundary navigation, dialog and menu semantics/Escape handling, profile
  field association contracts, and representative 44px compact-control
  contracts. No test uses production services, a live API, or a database.
- Verification: the client test command passes 10 tests: 6 normal tests and 4
  explicit expected-failure checks for the existing W1-01 findings. Root
  `npm test` runs those client tests and all 10 server tests successfully.
  Client lint, typecheck, build, the full `npm run check`, and
  `git diff --check` pass.
- Expected failures: profile field associations, dialog opening focus, and
  program menu sizing remain intentionally represented with `it.fails` until
  the owning W1-03/W1-04 UI tickets correct the existing behavior. The tests
  remain local and do not use production services, a live API, or a database.
- Result: W1-02 passed review. Promote the expected-failure assertions to
  normal assertions after the owning UI fixes land.

### W1-02 Review Notes

- Review date: 2026-09-01.
- Result: passed. The expected-failure contracts now check the complete named
  profile and menu requirements without arbitrary IDs or first-item masking;
  the dialog opening check uses a focused trigger and the Escape check targets
  the overlay handler.
- Isolation: auth and profile service modules are mocked, the test setup
  rejects unexpected Fetch/XHR traffic, and every test QueryClient is cleared
  after cleanup. No production service, live API, or database is used.
- Scope: changes are limited to client test files and configuration, client
  development dependencies and lockfile metadata, the root/client test
  scripts, and ticket documentation. No application, server API, schema,
  migration, database, or deployment file was changed.
- Verification: `npm run check` passed with 5 client files, 6 normal tests,
  4 expected failures, and 10 server tests. W1-02 is accepted; W1-03 was the
  next proposed ticket at the time of this report.

## W1-03: Correct Shared Accessibility And Interaction Primitives

**State:** done

### Goal

Fix confirmed shared control problems so page-level mobile work can reuse
consistent accessible fields, dialogs, menus, tabs, and navigation controls.

### Scope

- Apply W1-01 findings to shared form, dialog, menu, tab, and navigation
  components.
- Correct labels, error associations, focus behavior, keyboard handling,
  announcements, and shared touch-target rules.
- Standardize overlay scroll locking and focus restoration where a shared
  primitive owns the behavior.
- Give nested custom-exercise forms the same dialog semantics as their parent
  picker.
- Add focused component tests for changed primitives.

### Out of scope

- Page-specific redesigns.
- New product features.
- Unconfirmed accessibility changes unrelated to shared primitives.

### Acceptance criteria

- AC1: Every changed form control has a programmatic accessible name.
- AC2: Changed dialogs have defined keyboard dismissal and focus behavior.
- AC3: Dynamic errors and important status changes are announced where
  applicable.
- AC4: Changed controls meet the ticket's approved mobile touch-target rule.
- AC5: Focused tests and client checks pass.
- AC6: Opening a changed dialog moves focus inside it, Tab and Shift+Tab do not
  reach background controls, Escape dismisses when allowed, and focus returns
  to the trigger.
- AC7: Standalone actionable controls are at least 44px by 44px unless an
  approved exception is recorded; compact inline text links are not treated as
  standalone controls.
- AC8: Changed dynamic errors and success messages use an applicable alert or
  live-region contract.

### Verification

- Run focused shared-component tests.
- Run client lint and typecheck.
- Test keyboard focus and Escape behavior manually.
- Check changed controls at 375px.

### Stop conditions

- Stop if a shared change would require redesigning unrelated pages.
- Stop if expected semantics conflict with the mockup or an unresolved
  product decision.

### W1-03 Implementation Report

- Date: 2026-09-02.
- State: `done`.
- Added a shared `Dialog` primitive with initial focus, Tab and Shift+Tab containment, allowed Escape dismissal, focus restoration, and body scroll locking. The lock preserves nested overlays and restores prior body styles and scroll position.
- Migrated program creation, rename, delete, day, exercise-picker, custom-exercise, workout delete, and cancel overlays to the shared contract. Added labelled descriptions, explicit field IDs where needed, live status/error regions, and 44px standalone action targets.
- Improved the program action menu with menu-button semantics, focus entry/restoration, arrow/Home/End navigation, Escape/Tab handling, and 44px menu items. Exercise-picker source controls now expose tab semantics and keyboard navigation; the custom-exercise state uses the active picker dialog semantics.
- Shared auth-field validation messages now use an alert contract. No server, API, schema, migration, database, dependency, or deployment behavior changed.
- Verification: `npm run check` passed end to end. Client tests report 10 passing tests and 2 expected W1-04 profile failures; server tests report 10 passing tests. Client lint, typecheck, build, health smoke, and `git diff --check` pass. The existing client bundle-size warning remains.
- Manual review: Chrome CDP at exactly 375px verified the program create dialog, program action menu, program exercise picker/custom-exercise flow, and active-workout swap/delete/cancel dialogs. Focus entered each overlay, Tab remained contained, Escape returned focus to the trigger, menu arrow navigation worked, controls stayed within the viewport, and body scroll locking cleared. The temporary active workout session used for this check was deleted afterward.

## W1-04: Correct Authentication And Profile Mobile Issues

**State:** done

### Goal

Fix confirmed 375px layout, form, accessibility, loading, and error issues on
the authentication and profile screens.

### Scope

- Login, registration, forgot-password, reset-password, profile, edit-profile,
  and change-password screens.
- Use the shared primitives from W1-03.
- Preserve public registration.
- Correct the profile edit and change-password field IDs, label associations,
  autocomplete values, status announcements, and password-visibility targets.

### Out of scope

- Email verification, OAuth linking, account deletion, export, or legal pages.
- Authentication API redesign.
- New profile preferences.

### Acceptance criteria

- AC1: Each changed screen is usable at 375px without horizontal scrolling.
- AC2: Inputs have accessible labels, suitable autocomplete values, and
  visible validation/error states.
- AC3: Pending submissions prevent accidental duplicate actions.
- AC4: Network and server errors do not expose sensitive implementation
  details.
- AC5: Existing successful authentication and profile flows continue to work.
- AC6: Profile and password fields have explicit label associations and
  suitable autocomplete values; standalone visibility controls meet the 44px
  target rule; visible mutation feedback is announced.

### Verification

- Run focused client tests, lint, and typecheck.
- Manually check all changed screens at 375px.
- Check keyboard-open and browser-autofill states where available.

### Stop conditions

- Stop if the fix requires changing server authentication behavior.
- Stop if a legal, privacy, or external-service decision is required.

### W1-04 Implementation Report

- Date: 2026-09-02.
- State: `done`.
- Added explicit IDs, label associations, and `username`, `email`,
  `current-password`, and `new-password` autocomplete values to the profile
  edit and change-password forms.
- Added announced profile/logout and password mutation feedback, 44px password
  visibility controls, and a 44px logout target. Password visibility toggles
  preserve input focus and selection.
- Promoted the two profile field contracts and added password feedback/touch
  target coverage. No server, API, schema, migration, database, dependency, or
  deployment behavior changed.
- Verification: `npm run check` passed end to end with 13 client tests and 10
  server tests. Client lint, typecheck, build, health smoke, and
  `git diff --check` pass. The existing client bundle-size warning remains.
- Manual review: Chrome CDP at exactly 375px checked `/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/profile`, `/profile/edit`, and
  `/profile/password`; each had no document-level horizontal overflow, and the
  profile field and visibility contracts rendered as expected.
- Acceptance: independent review passed. Browser autofill and real soft-keyboard
  rendering were not available in this environment, but no finding remained from
  the available route, test, and 375px checks.

## W1-05: Resolve Dashboard Behavior And Loading Decisions

**State:** done

### Goal

Resolve open dashboard product decisions before implementing dashboard changes
that would otherwise require Luna to guess.

### Scope

- Record dashboard streak progress and timezone behavior as deferred rather than
  inventing rules for Wave 1.
- Define the persistent Up Next selection and empty-state behavior.
- Decide the active-program link behavior and `/program` fallback.
- Define the proposed branded loading treatment, animation style, and screen
  coverage, then provide a temporary visual prototype for approval.
- Convert the approved decisions into measurable acceptance criteria for W1-06.

### Out of scope

- Implementing dashboard code.
- Implementing streaks, timezone storage, or weekly training schedules in the
  React client, API, or database.
- Changing workout, progress, or authentication rules.
- Choosing legal or privacy policy language.

### Acceptance criteria

- AC1: Wave 1 explicitly records streak progress and timezone behavior as
  deferred; W1-06 does not add a streak card, streak API field, or timezone
  assumption.
- AC2: Up Next behavior is defined with testable examples for a first workout,
  normal sequence, rest days, missing prior context, and empty programs.
- AC3: The active-program link and fallback behavior are unambiguous.
- AC4: Loading treatment scope, visual treatment, animation, accessible status,
  and reduced-motion behavior are defined, with a temporary prototype available
  for visual review.
- AC5: W1-06 contains measurable criteria based on the approved decisions.

### Verification

- User reviews and approves the documented product decisions.
- Planning/review pass confirms no behavior remains ambiguous.
- Inspect the documentation diff and run `git diff --check`.
- Confirm no application, API, schema, migration, dependency, or deployment
  files changed.

### Stop conditions

- Stop before dashboard implementation until the temporary loader prototype is
  visually approved.

### W1-05 Decision Record

- Date: 2026-09-03.
- Streak progress and timezone behavior are deferred to a later product
  decision. Wave 1 will not infer a streak definition from the existing
  session timestamps.
- The dashboard label becomes `Up Next`. It shows the next non-empty day in the
  active program's ascending order. A rest day requires no interaction; the
  recommendation remains unchanged until a workout is completed.
- The latest completed session continues to mean the existing dashboard API's
  most recently started finished session. Changing that timestamp rule is
  deferred with streak behavior.
- With no completed session in the active program, Up Next is the first day
  containing exercises. After a completed day, it is the next later non-empty
  day, wrapping to the first non-empty day when necessary. If the latest
  completed session's day is deleted or belongs to another program, it falls
  back to the first non-empty day.
- If the active program has no day containing exercises, the dashboard shows an
  Edit Program action and no Start Workout action. If there is no active
  program, the Program action falls back to `/program`.
- The primary Program action links to `/program/:activeProgramId` when an active
  program exists and to `/program` otherwise.
- The proposed loader uses the existing RepLog mark, a polite status message,
  and a three-rep animation: the three bars slide in sequentially, the `RL` mark
  lifts after the third bar, and decorative dots pulse. Auth gates use a centered
  full-screen version; primary page queries on Dashboard, History, Progress,
  Program Library, Program Editor, Workout, and Profile preserve the
  authenticated shell and replace the page content with the branded treatment.
  Reduced-motion users see the same layout without animation. Inline mutations,
  background navigation refreshes, and nested dialog fetches retain their
  contextual pending states.
- Temporary visual prototype for review:
  `C:\Users\User\AppData\Local\Temp\opencode\replog-w1-05-loader-prototype.html`.

### Up Next Examples

- Given ordered active days `Upper A`, `Lower A`, `Upper B`, and no completed
  session, the result is `Upper A`.
- After completing `Lower A`, the result is `Upper B`.
- After completing `Upper B`, the result wraps to `Upper A`.
- If `Lower A` has zero exercises, it is skipped; after `Upper A`, the result
  is `Upper B`.
- If the latest completed day was deleted or belongs to another program, the
  result is the first non-empty day in the current active program.
- If three rest days pass without a completion, the result does not change and
  no rest-day action is required.
- If every active-program day is empty, the result is an Edit Program action
  with no Start Workout action. With no active program, the Program action
  targets `/program`.
- If an active workout exists, the existing Resume Workout state takes
  precedence and starting another workout remains unavailable.

### W1-05 Review Report

- State: `done`.
- The decision record and W1-06 acceptance criteria were updated; no React, API,
  schema, migration, or deployment code changed.
- The temporary prototype contains auth-gate, shell-preserving page-query, and
  reduced-motion examples at the 375px acceptance width. Its controls switch
  between the three-rep animation and static previews.
- Chrome DevTools metrics verification at exactly `375x900` reported a
  `375px` viewport, no overflowing element, and a prototype phone that stayed
  inside the available content width; the 375px screenshot was captured at
  `C:\Users\User\AppData\Local\Temp\opencode\replog-w1-05-loader-375-reps.png`.
- The same browser check reported `rep-bar-in`, `rep-mark-lift`, and
  `loading-dot` under no-preference motion and `none` after switching the
  reduced-motion preview.
- Approval: the user visually approved the three-rep loader prototype at 375px.
  The three bars slide in sequentially, the RL mark lifts after the third bar,
  and decorative dots pulse. Reduced-motion mode disables animation and shows
  the same layout statically. The prototype remains temporary and outside Git.
  W1-05 is accepted; W1-06 is the next ticket.

## W1-06: Correct Shell, Navigation, And Dashboard Mobile Issues

**State:** review

### Goal

Apply the confirmed baseline findings and W1-05 decisions to the application
shell, navigation, dashboard, and shared page-loading treatment.

### Scope

- Top/bottom navigation and application shell.
- Dashboard layout, persistent Up Next states, active-program links, and the
  approved loading treatment.
- The shared branded loading treatment for the Dashboard, History, Progress,
  Program Library, Program Editor, Workout, and Profile primary page-query
  states, while preserving the authenticated page shell where applicable.
- Safe-area spacing, fixed navigation, overflow, and mobile scrolling.
- Verify that the fixed mobile navigation does not cover the final dashboard
  content or actions.

### Out of scope

- Program, workout, history, or progress feature changes outside shared shell
  behavior.
- New dashboard rules not approved in W1-05.
- Streak progress, timezone storage, weekday scheduling, or daily rest-day
  configuration.

### Acceptance criteria

- AC1: Changed shell and dashboard screens have no unintended horizontal
  scrolling at 375px.
- AC2: Fixed navigation does not cover interactive content.
- AC3: Active navigation and dashboard links are clear and keyboard usable.
- AC4: Loading, empty, error, and populated states meet W1-05 decisions.
- AC5: Dashboard API behavior remains unchanged except for the explicitly
  approved non-empty Up Next selection; no streak or timezone contract is
  introduced.
- AC6: At the bottom of each changed dashboard state, the last actionable
  content remains reachable above the fixed navigation at 375px.
- AC7: Up Next keeps the same day across rest days without requiring a rest-day
  action, selects the first or next non-empty ordered day according to W1-05,
  and wraps correctly. When an active program has no usable day, it shows Edit
  Program; when no active program exists, it uses the `/program` fallback.
- AC8: The primary Program action opens `/program/:activeProgramId` when an
  active program exists and `/program` otherwise; all changed links are named
  and keyboard usable.
- AC9: Auth-gate loading is full-screen; primary page-query loading preserves
  the authenticated shell, exposes a polite status, and becomes static under
  `prefers-reduced-motion: reduce`. Mutation, dialog, and background-navigation
  refresh pending states are not replaced by the page loader.

### Verification

- Run focused client tests, lint, and typecheck.
- Manually check dashboard states at 375px.
- Check keyboard navigation and reduced-motion behavior.

### Stop conditions

- Stop if implementing a dashboard rule requires a server/API or data-model
  change not listed in the approved ticket.

### W1-06 Implementation Report

- Date: 2026-09-03.
- State: `review`.
- Corrected dashboard selection to choose only non-empty ordered days, skip
  empty days, wrap after the last usable day, and return `null` when every day
  is empty. No API field or data-model change was introduced.
- Added dynamic active-program targets to the shared desktop and mobile Program
  navigation links, with `/program` fallback and correct active state for
  `/program/:programId`.
- Replaced the initial loader implementation with the approved inline RepLog
  mark animation: the real three bars slide in sequentially, the RL monogram
  lifts, and dots pulse on the prototype's repeating timing. Auth gates use a
  centered full-screen lockup; page queries preserve the shell in a loading
  card. Reduced-motion users receive a static equivalent.
- Profile now waits for both identity and dashboard statistics before showing
  profile content, and displays a safe stats error instead of false zeroes when
  the dashboard query fails. Empty dashboard copy no longer refers to a
  suggested routine.
- Added focused client coverage for loader semantics/variants, Program
  navigation targets, dashboard fallback states, background refresh behavior,
  and Profile loading. Added a server integration suite covering all approved
  Up Next examples, including deleted/other-program fallback and all-empty
  behavior.
- Verification: `npm run check` passed end to end with 22 client tests and 11
  server tests. Client/server lint, typecheck, build, health smoke, and
  `git diff --check` pass. The existing client bundle-size warning remains.
- Manual review: local Chrome CDP at exactly `375x900` verified an authenticated
  dashboard with `/program/:activeProgramId` navigation, no horizontal
  overflow, and reachable bottom navigation. A blocked local History query
  verified the shell-preserving loader, `Loading history...` polite status,
  reduced-motion mode, and no horizontal overflow. The temporary local browser
  account used for this check was disposable.
- Follow-up visual refinement: the shared loader now displays only the animated
  three bars and RL mark. The loading status remains screen-reader-only, and no
  development preview flag or comparison mode is retained.

### W1-06 Review Notes

- Review date: 2026-09-03.
- The initial W1-06 commit was reviewed and corrected for non-empty Up Next
  selection, empty-day start controls, exact loader behavior, Profile query
  loading, missing tests, and branch placement.
- The ticket is ready for independent acceptance review. No production deploy,
  database migration, schema change, or credential change was made.

## W1-07: Correct Program And Exercise-Picker Mobile Issues

**State:** review

### Goal

Fix confirmed mobile and accessibility issues in program browsing, editing,
menus, dialogs, and exercise selection.

### Scope

- Program library and program editor.
- Program action menus and delete dialogs.
- Exercise picker and custom-exercise form.
- Long names, empty states, scrolling, and touch targets.
- Apply the shared dialog focus, Escape, background-scroll, and focus-restore
  contract to program and exercise overlays.
- Preserve existing exercise reordering and the current two-step custom-exercise
  flow: save returns to the picker with the new exercise selected, then the user
  confirms Add Exercise.

### Out of scope

- Whole-day reordering.
- Custom exercise edit/delete feature work.
- Changes to program API semantics.
- Workout-specific picker acceptance, which belongs to W1-08; shared picker
  changes must not regress the workout add/swap modes.

### Acceptance criteria

- AC1: Changed program screens are usable at 375px without clipped content or
  horizontal scrolling.
- AC2: Menus and dialogs are keyboard accessible, contain Tab and Shift+Tab,
  dismiss safely, and restore focus to a surviving trigger or an intentional
  stable fallback when the trigger was deleted.
- AC3: Empty, loading, error, and long-name states remain understandable;
  primary program, day, exercise, and dialog names wrap at mobile widths,
  including unbroken maximum-length values.
- AC4: Existing template, blank, copy, rename, activation, program deletion,
  day CRUD, exercise add/remove/reorder, and custom-exercise creation behavior
  remains intact. Copy-generated names remain within the server's 80-character
  limit.
- AC5: Program menus, dialogs, and the nested custom-exercise form keep focus
  contained, dismiss safely, and expose their labels and actions at 375px.
- AC6: Standalone changed actions remain at least 44px by 44px; dialog content
  scrolls internally at constrained mobile heights while background scrolling is
  locked.
- AC7: The picker distinguishes an empty source from a search with no matches,
  preserves Program days and All exercises grouping, marks already-added
  exercises clearly, and keeps the saved custom exercise selected.
- AC8: Pending mutations prevent conflicting state changes and expose an
  understandable status; duplicate-name messages are reserved for conflict
  responses and other failures offer a safe retry message.

### Verification

- Run focused client tests, lint, and typecheck.
- Manually check program and picker flows at exactly 375x900 and constrained
  375x667.
- Test keyboard, Escape precedence for copy-program and exercise-category
  selects, scrolling, focus fallback, long exercise names, pending states, and
  failed mutations.

### Stop conditions

- Stop if the issue requires adding deferred program features or changing the
  server contract.

### W1-07 Implementation Notes

- Long primary names wrap; secondary category summaries may truncate when the
  available row width requires it.
- Saving a custom exercise returns to the picker with that exercise selected;
  it does not add the exercise until Add Exercise is confirmed.
- The five implementation commits are grouped by keyboard/focus behavior,
  mobile layout and scrolling, program creation states, picker states, and
  mutation feedback.

### W1-07 Implementation Report

- Date: 2026-09-04.
- State: `review`.
- `607bf3c` makes copy-program and exercise-category selects stop Escape at the
  nested listbox, keeps disabled program delete actions keyboard-focusable, and
  adds stable fallback focus for destructive dialogs.
- `303a6e2` wraps long primary names and dialog copy, and bounds program delete
  and rename dialogs for internal mobile scrolling.
- `8bf3e99` keeps generated copy names within 80 characters and makes template
  loading failures visible and non-submittable.
- `e82d60c` distinguishes empty picker sources from no-match searches, clears
  stale add-exercise errors on reopen, and disables conflicting picker controls
  while saving.
- `e961268` adds safe conflict-versus-generic mutation messages, announces
  reorder failures, and blocks conflicting program-editor mutations.
- Focused client coverage now has 30 passing tests across 10 files. Client
  lint, typecheck, production build, Prisma generation/validation, and
  `git diff --check` pass. The existing client bundle-size warning remains.
- The repository-wide `npm run check` reached the server test phase but could
  not connect to PostgreSQL at `localhost:5432`; the installed
  `postgresql-x64-17` service is stopped and this session lacks permission to
  open it. Server tests, health smoke, and exact 375px browser acceptance are
  therefore pending independent review with the local database available.

### W1-07 Correction Report

- Date: 2026-09-04.
- Added a one-shot `programs-heading` navigation focus request for editor
  deletion. The Programs page focuses its stable heading after navigation so
  focus does not remain on an unmounted menu trigger.
- Included activation in the editor-wide pending mutation lock, disabled
  submitted create, rename, day-name, and badge-color controls, and added a
  polite announced `Reordering exercise...` state.
- Added a route-level focus regression test. Client coverage now has 31
  passing tests across 11 files; client lint, typecheck, and production build
  pass. The existing client bundle-size warning remains.
- The earlier server-check blocker is cleared: the full repository `npm run
  check` now passes with 31 client tests and 11 server tests. Exact
  375px/375x667 browser acceptance remains pending, so W1-07 remains in
  `review` until that independent check passes.

### W1-07 UI Correction Report

- Date: 2026-09-04.
- Improved long day labels by giving the primary badge the available mobile
  width, placing the category summary below it, and using a multi-line-safe
  rounded rectangle instead of a capsule.
- Removed the reorder flash by applying the optimistic exercise order before
  awaiting React Query cancellation. Dragged rows keep stable dimensions,
  remain vertically constrained visually, and retain their elevation while
  moving.
- Focused client tests, lint, typecheck, and production build pass. The full
  repository check had already passed before this UI-only correction; exact
  375px/375x667 browser verification remains pending.

### W1-07 Drag Interaction Correction

- Date: 2026-09-04.
- Added a non-scaling `DragOverlay` with a stable 60px row preview, vertical
  movement constraint, and short eased drop animation. The active list row is
  now a stable placeholder instead of being stretched to the height of a
  neighboring wrapped row.
- Reorder cache updates remain synchronous before query cancellation, so the
  destination order is visible immediately on release.
- Client tests (31), lint, typecheck, and production build pass. Manual
  verification at exactly 375x900 and 375x667 remains required for final UI
  acceptance.

### W1-07 Reorder Timing Correction

- Date: 2026-09-04.
- Removed the redundant active-exercise cleanup timer, shortened the overlay
  drop animation to 130ms, and made related query invalidation fire in the
  background after the authoritative reorder response.
- Reorder controls now unlock when the server confirms the operation instead
  of waiting for program, active-program, and dashboard refreshes. Failed
  requests retain the existing rollback behavior.
- Client tests, lint, typecheck, production build, and the full repository
  check pass. Manual browser verification remains required.

### W1-07 Drop Animation Correction

- Date: 2026-09-04.
- Added a local displayed-order override so the reordered destination layout
  is available in the same drag-end render that dnd-kit uses to measure its
  drop animation. The override reconciles with the server response and rolls
  back cleanly on failure.
- The drag preview now matches the row's control spacing, while the source is
  a transparent height-preserving placeholder. This prevents the overlay from
  resizing or competing visually with the destination row.
- Client tests (31), lint, typecheck, and production build pass. Exact
  375px/375x667 browser verification remains required.

### W1-07 Immediate Drop Adjustment

- Date: 2026-09-04.
- Removed the post-release DragOverlay animation so the synchronously updated
  destination row appears immediately when the pointer or thumb is released.
- Tests and builds were not run for this adjustment at the user's request.

## W1-08: Correct Active-Workout Mobile Issues

**State:** proposed

### Goal

Fix confirmed active-workout layout, interaction, timer, overlay, and error
issues at the primary 375px acceptance width.

### Scope

- Exercise cards and set entry.
- Keyboard-open behavior and scrolling.
- Existing rest/workout timer presentation and persistence.
- Existing add/swap/remove dialogs and completion flow.
- Confirmed previous-set display issues that do not require new product data.
- Correct compact set controls, including drop-set actions, to the approved
  standalone touch-target rule.

### Out of scope

- Configurable rest-timer preferences.
- Workout-level notes.
- Active-workout exercise reordering.
- New set types or API behavior.

### Acceptance criteria

- AC1: Set entry remains usable at 375px with no horizontal scrolling.
- AC2: The mobile keyboard does not hide the active input or required action.
- AC3: Existing timer persistence, add/swap/remove, and completion behavior
  continue to work after the UI changes.
- AC4: Pending and failed mutations preserve understandable user feedback.
- AC5: Dialogs and overlays have usable focus and dismissal behavior.
- AC6: Add-set, drop-set, swap, remove, cancel, and completion controls remain
  usable at 375px, with standalone controls at least 44px by 44px.

### Verification

- Run focused workout tests, lint, and typecheck.
- Manually test an active workout at 375px, including refresh, timer,
  validation, failed mutation, and completion states.

### Stop conditions

- Stop if the fix requires a new schema field, mutation contract, or deferred
  workout feature.

## W1-09: Correct History And Progress Mobile Issues

**State:** proposed

### Goal

Fix confirmed mobile layout, empty-state, long-content, and accessibility
issues in history and progress screens.

### Scope

- History list and completed-session navigation.
- Progress statistics, trend content, and current empty states.
- Responsive tables or summaries and text overflow.

### Out of scope

- SVG progress chart implementation.
- kg/lb preference implementation.
- New progress calculations or API aggregation.

### Acceptance criteria

- AC1: Changed history and progress screens are usable at 375px without
  horizontal scrolling.
- AC2: Empty, loading, error, and populated states remain distinguishable.
- AC3: Long exercise names, values, and dates do not make controls unusable.
- AC4: Existing history and progress values are not changed by layout work.

### Verification

- Run focused client tests, lint, and typecheck.
- Manually check empty and populated screens at 375px.
- Verify navigation to completed-session details.
- Verify one completed normal working set appears in the populated progress
  state and remains readable at 375px.

### Stop conditions

- Stop if visual work requires changing progress calculations or adding the
  deferred chart/unit features.

## W1-10: Add Browser Coverage And Complete The Wave 1 Gate

**State:** proposed

### Goal

Automate the critical mobile journey and confirm the Wave 1 acceptance gate
without introducing new product scope.

### Scope

- Add or complete local Playwright coverage at 375px.
- Cover public auth, navigation, program selection, workout completion, and
  history where the local environment supports it.
- Run final client/server checks and record remaining manual evidence.
- Carry the W1-01 route matrix and its unobserved-state list into the browser
  suite or final manual evidence.

### Out of scope

- New mockup features.
- Production deployment.
- Staging setup.
- Broad load, security, or account-lifecycle work.

### Acceptance criteria

- AC1: Critical browser flows run repeatably against the local application.
- AC2: The mobile browser project uses a 375px viewport and produces useful
  failure artifacts.
- AC3: Client tests, server tests, lint, typecheck, build, and diff checks pass.
- AC4: Manual 375px acceptance findings are closed or have approved follow-up
  tickets.
- AC5: `STATUS.md` records Wave 1 completion or the precise blocker; Phase 4
  remains blocked if the mobile gate is incomplete.

### Verification

- Run `npm run check`.
- Run the Playwright suite against local services.
- Manually verify critical flows at 375px, then spot-check 768px and 1080px.
- Review the complete Wave 1 diff.

### Stop conditions

- Stop if a failure requires new product scope or an unresolved decision.
- Stop if the gate cannot run safely against local data.

## Audit Findings

### Audit Method

- Date: 2026-09-01.
- Environment: local Vite client at `http://127.0.0.1:5173` and local Express
  API at `http://127.0.0.1:4000`; the production deployment was not used.
- Browser: Chrome DevTools Protocol with an exact `375x900` viewport and DPR 1.
- Evidence: JSON and PNG captures in
  `C:\Users\User\AppData\Local\Temp\opencode\replog-audit-evidence`.
- Touch-target rule used for this audit: standalone actionable controls are at
  least 44px by 44px. Inline text links are excluded from that measurement.
- The local audit used a disposable account and generated local program,
  workout, history, and progress data only.

### Route Coverage

Every route entry in `client/src/router.tsx` was reached locally. State coverage
is listed separately so an unobserved state is not mistaken for a route defect.

| Route | Observed evidence | Route result or unobserved state |
| --- | --- | --- |
| `/` | `31-root-redirect.json` | Redirects to `/login`. |
| `/login` | `01-login-empty.json` | Empty state observed. Invalid-credential API error was not confirmed. |
| `/register` | `02-register-empty.json`, `03-register-validation.json`, `04-dashboard-empty.json` | Empty, validation, and successful registration observed. |
| `/forgot-password` | `27-forgot-password-empty.json`, `28-forgot-password-validation.json`, `29-forgot-password-api-error.json` | Empty, validation, and privacy-safe success observed; no server error is exposed for an unknown email. |
| `/reset-password` | `30-reset-password-error.json` | Missing-token error observed; valid-token success requires an unexpired token and was not observed. |
| `/dashboard` | `04-dashboard-empty.json`, `33-dashboard-bottom.json` | Empty and populated bottom-of-page states observed; active-session dashboard state was not captured. |
| `/history` | `17-history-empty-before-workout.json`, `24-history-populated.json` | Empty and populated states observed. |
| `/profile` | `07-profile.json` | Settled profile state observed. |
| `/profile/edit` | `08-edit-profile.json` | Settled edit form observed. |
| `/profile/password` | `09-change-password.json` | Settled change-password form observed. |
| `/progress` | `06-progress-empty.json`, `42-progress-populated.json` | Empty and populated normal-set states observed. |
| `/program` | `10-program-library.json`, `11-program-menu.json`, `12-create-program-dialog.json`, `34-create-dialog-mouse-focus.json`, `35-create-dialog-after-tab.json` | Library, menu, and create-dialog states observed. |
| `/program/:programId` | `13-program-editor.json`, `14-add-day-dialog.json`, `15-exercise-picker.json`, `16-new-exercise-dialog.json`, `36-add-day-mouse-focus.json`, `37-add-day-after-tab.json` | Editor, day dialog, picker, and custom-exercise states observed. |
| `/workout/:sessionId` | `18-workout-empty.json` through `23-workout-completed.json`, `40-workout-normal-set.json`, `41-workout-completed-normal.json` | Active, set-entry, normal-set, swap, remove, and completed states observed. |
| `*` | `32-not-found.json` | Not-found state observed. |

### Confirmed Baseline

- No captured state had document-level horizontal overflow: `scrollWidth` was
  never greater than the client width at 375px.
- Long content remained vertically scrollable, including registration at
  1095px, the program editor at 1754px, and active workout set entry at
  2154px.
- Primary buttons, icon controls, navigation links, dialog actions, and form
  inputs generally met the 44px target rule. The exceptions are listed below.
- Registration validation focused `#register-username`; forgot-password
  validation focused `#forgot-password-email`; reset-password displayed its
  missing-token error while focusing `#new-password`.
- Auth fields use explicit labels, error descriptions, and suitable
  autocomplete values in `LoginPage`, `RegisterPage`, `ForgotPasswordPage`,
  and `ResetPasswordPage`.
- The fixed bottom navigation remained visible, and the dashboard bottom
  content ended above it in `33-dashboard-bottom.json`.
- A completed normal set produced a readable populated progress state in
  `42-progress-populated.json`, including estimated 1RM, session history, and
  trend content.
- The observed slate palette, auth card, mobile navigation, program/workout
  overlays, and progress structure follow the mockup intent and the build
  plan's mobile-first direction. No product decision conflict was found.

### Confirmed Findings

| ID | Route and state | Finding | Severity | Evidence and source reference | Follow-up and measurable condition |
| --- | --- | --- | --- | --- | --- |
| F-01 | `/program` create dialog, program day dialog, exercise picker, workout remove dialog | Opening overlays does not reliably move focus into the active dialog. Focus remained on the trigger for create/day dialogs, moved to background content after one Tab, or was null for the picker/remove dialog. The workout remove dialog remained rendered after Escape in the captured sequence. | High | `34-create-dialog-mouse-focus.json`, `35-create-dialog-after-tab.json`, `36-add-day-mouse-focus.json`, `37-add-day-after-tab.json`, `15-exercise-picker.json`, `22-workout-remove-dialog.json`, `23-workout-completed.json`; `client/src/pages/ProgramLibraryPage.tsx:319-330`, `client/src/pages/ProgramPage.tsx:635-647`, `client/src/components/exercises/ExercisePickerDialog.tsx:226-255`, `client/src/pages/WorkoutPage.tsx:1404-1465` | W1-03, then W1-07/W1-08. Every changed dialog must move focus inside on open, contain Tab and Shift+Tab, dismiss on allowed Escape, and restore focus to its trigger. |
| F-02 | `/program/:programId` custom-exercise form | The nested New Exercise form is rendered under the picker overlay without `role="dialog"`, `aria-modal`, or `aria-labelledby`. Its autofocus input therefore reports as outside a dialog despite the visible dialog title. | Medium | `16-new-exercise-dialog.json`; `client/src/components/exercises/ExercisePickerDialog.tsx:79-98`, `:226-255` | W1-03 and W1-07. The nested form must expose labelled dialog semantics and participate in the same focus and Escape contract as the picker. |
| F-03 | `/profile/edit` and `/profile/password` settled forms | Profile edit and change-password labels are visual only: their labels have no `htmlFor` and inputs have no matching IDs. These fields also omit suitable autocomplete values. Change-password error and success messages have no alert or live-region semantics. | Medium | `08-edit-profile.json`, `09-change-password.json`; `client/src/pages/EditProfilePage.tsx:73-94`, `client/src/pages/ChangePasswordPage.tsx:108-192` | W1-04. Each field must have an explicit label association and appropriate `username`, `email`, `current-password`, or `new-password` autocomplete; mutation feedback must be announced. |
| F-04 | `/profile/password`, active workout add-set form, program action menu | Three standalone controls are below the 44px target rule: password visibility buttons are 45.8x24px, `+ Drop` is 50.1x24px, and program menu items are 146x40px. | Medium | `09-change-password.json`, `40-workout-normal-set.json`, `11-program-menu.json`; `client/src/pages/ChangePasswordPage.tsx:119-179`, `client/src/pages/WorkoutPage.tsx:1192-1200`, `client/src/components/programs/ProgramActionsMenu.tsx:128-139` | W1-03, W1-04, W1-07, and W1-08. Standalone controls must render at least 44px by 44px without clipping or loss of the existing action. |
| F-05 | `/program` create dialog | The create dialog is open while `document.body` retains `overflow: visible`; the page does not use the body scroll-lock hook used by the program editor. The short captured library did not visibly move behind the overlay, so the background-scroll effect is not yet confirmed. | Low | `34-create-dialog-mouse-focus.json`; `client/src/pages/ProgramLibraryPage.tsx:1-57,319-330,428-482`, `client/src/components/programs/ProgramDeleteDialog.tsx:23-34`, `client/src/pages/ProgramPage.tsx:45,163`, `client/src/lib/useBodyScrollLock.ts:3-28` | W1-03 and W1-07. While each full-screen create, rename, and delete overlay is open, attempts to scroll the background must not change the page scroll position; closing it must restore the prior body styles and scroll position. Verify all three states at 375px. |

### Unobserved States

- Loading states were not captured because each navigation settled before the
  snapshot; no network throttling was introduced.
- A real login API error was not captured because the first harness selected the
  auth tab link instead of submitting the invalid login form. No login error
  defect is asserted.
- Valid reset-token success, email delivery, Google OAuth, and browser autofill
  could not be observed in the local configuration.
- Native mobile keyboard-open behavior, keyboard traversal across every page,
  Shift+Tab traversal, reduced-motion behavior, and focus restoration after
  every menu/dialog were not fully covered by the CDP pass.
- Profile edit/password mutation errors, failed program/workout mutations,
  pending duplicate-action behavior, program deletion, custom-exercise save,
  workout inline editing, cancel-workout confirmation, and the dashboard active
  session state were not forced without request mocking or extra destructive
  local data changes.
- The primary audit did not include the 768px or 1080px responsive spot checks;
  those remain W1-10 verification work.

### Audit-Derived Follow-Ups

- W1-02 is now `ready` and must establish regression coverage before UI fixes.
- W1-03 owns the shared modal/menu focus, Escape, focus-restore, scroll-lock,
  status-announcement, and standalone touch-target contract.
- W1-04 owns the profile form associations, autocomplete, mutation feedback,
  and password-visibility target corrections.
- W1-05 remains a product-decision gate for Up Next, active-program navigation,
  and branded loading; dashboard streak rules and timezone behavior are
  explicitly deferred.
- W1-06 must preserve the observed no-overflow and bottom-navigation clearance
  while covering the unobserved active dashboard state.
- W1-07 owns program/editor/picker overlay behavior, including the nested custom
  exercise form and menu sizing.
- W1-08 owns active-workout compact controls and must verify a normal set,
  failed mutation, keyboard-open, timer, and completion sequence.
- W1-09 owns the readable empty and populated progress/history states; one
  populated normal-set progress state is now available as baseline evidence.
- W1-10 should automate the route matrix and preserve an explicit list of
  remaining manual states.

### W1-01 Completion Report

- State: `done`.
- Scope completed: all current router entries were reached locally at exactly
  375px; confirmed behavior, unobserved states, findings, severities, source
  references, and follow-up criteria are recorded above.
- Documentation changes owned by W1-01: `WAVE1.md` and `STATUS.md` only.
- Application, dependency, configuration, test, schema, migration, database,
  production, and deployment files were not changed by W1-01.
- Verification: local browser evidence was captured; the client build passed
  before the documentation pass; final documentation and diff checks are listed
  in `STATUS.md`.

### W1-01 Review Notes

- Review date: 2026-09-01.
- Result: passed.
- Precise issue: the original F-01 citation `38-picker-mouse-focus.json` did
  not show the exercise picker; its JSON showed the Add Day dialog. The citation
  was corrected to `15-exercise-picker.json`, whose body text identifies the
  picker, whose viewport is `375x900`, and whose `focus` is `null`. The corrected
  evidence mapping passed re-review, so W1-01 is accepted.

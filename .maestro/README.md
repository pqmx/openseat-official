# iOS end-to-end tests

Install Maestro and an EAS `e2e` simulator build (`com.pqmx.openseat`). That build uses the `preview` environment: point it at a dedicated test Supabase project, never production.

Sign in manually with a UCLA-eligible test account before authenticated flows. OAuth provider dialogs are manual tests; there is no authentication bypass.

| Command | Account/setup | Coverage |
| --- | --- | --- |
| `npm run e2e:smoke` | Completed profile | Tabs and account menu |
| `npm run e2e:write` | Completed profile | Places lookup, create room, host view, close room |
| `npm run e2e:onboarding` | Separate account with profile year reset to NULL | Onboarding and Discover routing |
| `npm run e2e:signed-out` | Run last; clears the saved session | Cold launch and auth gate |

Two-account joins, reports/blocks, and account deletion need separately resettable test accounts. These flows do not cover native provider sign-in or replace physical-device testing.

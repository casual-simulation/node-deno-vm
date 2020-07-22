# Security Policy

## Supported Versions

Only the latest major version will be supported with security updates.

Currently, this is `v0.6.x`.

| Version | Supported          |
| ------- | ------------------ |
| v0.6.x  | :white_check_mark: |

## Reporting a Vulnerability

High severity vulnerabilities can be reported via email to [devops@casualsimulation.com](mailto:devops@casualsimulation.com).

Medium to low severity vulnerabilities can be reported via [an issue](https://github.com/casual-simulation/node-deno-vm/issues).

Note that any vulnerability that allows the Deno sandbox to compromise the Node.js process would be considered high severity.
Misconfiguration foot-guns or other similar issues would be considered medium to low severity.

We will try to triage and mitigate issues to the best of our ability and will cooperate with reporters to find a good solution.
Of course, high quality vulnerability reports are more likely to be fixed quickly.

## Other Notes

Additionally, we will publish security advisories for all high severity issues once a fix is available but advisories for medium to low severity issues will be on a case-by-case basis.

Finally, we are likely to prefer breaking API changes in cases where non-breaking fixes are non-trivial.

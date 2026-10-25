# Low-risk change with complete evidence

**Decision:** GO
**Risk score:** 5/100

## Components
- Changed: ContactValidation
- Downstream impacted: None

## Dependency findings
- None

## Evidence
- Total: 2
- No evidence provided: No
- Passed: 2
- Failed: 0
- Missing: 0
- Not run: 0
- Unknown status: 0

### Checks
- Unit tests: passed
- Regression tests: passed

## Decision reasons
- Evidence is complete and the calculated risk is below the review threshold

**Recommended next action:** The analyzed checks passed. Follow the organization's approval process before deployment; this analysis is not deployment approval.

---

# High-impact change with missing regression evidence

**Decision:** HOLD
**Risk score:** 57/100

## Components
- Changed: PricingService
- Downstream impacted: CheckoutFlow, OrderCalculator

## Dependency findings
- CheckoutFlow (transitive; path: PricingService -> OrderCalculator -> CheckoutFlow)
- OrderCalculator (direct; path: PricingService -> OrderCalculator)

## Evidence
- Total: 2
- No evidence provided: No
- Passed: 1
- Failed: 0
- Missing: 1
- Not run: 0
- Unknown status: 0

### Checks
- Unit tests: passed
- Regression tests: missing

## Decision reasons
- 1 evidence check(s) missing or not run
- Missing evidence: Regression tests
- 2 unique downstream component(s) identified
- Risk score 57/100 requires review

**Recommended next action:** Confirm release readiness, obtain the relevant Copado job execution and automated test results, and rerun the impact analysis before considering promotion.

---

# Release with a failed test

**Decision:** BLOCK
**Risk score:** 12/100

## Components
- Changed: OrderTrigger
- Downstream impacted: None

## Dependency findings
- None

## Evidence
- Total: 2
- No evidence provided: No
- Passed: 1
- Failed: 1
- Missing: 0
- Not run: 0
- Unknown status: 0

### Checks
- Unit tests: failed
- Regression tests: passed

## Decision reasons
- 1 evidence check(s) failed
- Failed evidence: Unit tests

**Recommended next action:** Do not proceed until failed checks or blocking risks are resolved.
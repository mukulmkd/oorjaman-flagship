# GOOD_ENAHNCEMENTS

Non-business-critical enhancements to improve ops quality, moderation workflow, and long-term maintainability.

## Priority 1 (Recommended soon)

1. Dedicated feedback moderation page
   - Separate page (instead of only Operations overview section)
   - Filters: hidden/visible, low-rating-only, date range
   - Search by booking ref, vendor, technician

2. Moderation audit trail
   - Persist every hide/unhide action in a separate audit table
   - Store who changed it, when, old/new state, and reason
   - Add admin view for compliance-style traceability

3. Auto-flagging for risky feedback
   - Auto-create moderation candidates using simple rules:
     - repeated low ratings (for same vendor/technician)
     - keyword flags for abusive/sensitive text
   - Keep this as assistive, not auto-hide

## Priority 2 (Nice to have)

4. Stronger mandatory rating UX
   - Current implementation blocks leaving completed booking without rating
   - Improve with smoother inline guidance and progressive prompts

5. Rating confidence indicators
   - Show confidence bands (example: low confidence when rating_count < threshold)
   - Helps avoid overreacting to very small sample sizes

6. Trend diagnostics
   - Add 7-day vs 30-day comparison cards for vendor/technician ratings
   - Highlight rapid drops to accelerate ops intervention

## Priority 3 (Future)

7. ML-assisted sentiment labels (optional future)
   - Classify feedback sentiment/severity
   - Use for queue ordering, not direct moderation decisions

8. SLA for moderation queue
   - Add target resolution times and breach alerts
   - Display unresolved moderation items by age bucket

## Notes

- Go-live critical items are already implemented for rating collection and moderation controls.
- These enhancements are intentionally separated so launch is not blocked.

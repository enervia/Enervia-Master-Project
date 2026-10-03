# Enervia RFQ 2.0 Foundation

## Objective
Turn the current email-only RFQ flow into a structured procurement workflow without breaking the public RFQ form.

## Workflow
Customer submission -> RFQ record -> item extraction -> sourcing -> pricing -> approval -> quotation -> customer.

## Status model
- NEW: received, not reviewed
- REVIEW: technical/commercial review
- SOURCING: supplier/product research
- PRICING: source prices and commercial calculation
- PENDING_APPROVAL: quotation ready for internal approval
- QUOTED: quotation issued
- CLOSED: completed or cancelled

## Pricing model
For each item retain both source cost and selling price. The initial commercial rule is:
sellingPrice = sourcePrice * (1 + markupPercent / 100)

Markup must be editable per item and must never overwrite the original source price.

## Next implementation step
Add persistent storage and an authenticated admin panel. The public RFQ endpoint should then write the structured RFQ record before sending the notification email.

## Important
Do not store RFQs in local JSON/files inside a Vercel Function. Serverless instances are ephemeral. Use a persistent database before enabling production admin workflows.

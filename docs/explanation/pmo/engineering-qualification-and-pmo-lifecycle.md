---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Conceptual
Owns: Rationale for the Engineering qualification gate, PMO Pipeline versus Active split, ordered priority sequences, and Project Graduation
Does Not Own: Label schemas, dashboard JSON, weekly meeting procedure, or Product priority decisions
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3597
Last Reviewed: 2026-08-18
---

# Why Engineering Qualification and PMO Lifecycle Are Separate

## Purpose

Explain why LGFC splits Engineering qualification from PMO Pipeline preparation, and why Pipeline work is not Active implementation.

Machine labels, stage entry/exit facts, and dashboard fields live in `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`. Procedures live in `docs/how-to/pmo/run-pmo-lifecycle-and-priority.md`. Queue policy lives in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

## The problem the old model created

Treating Engineering as the owner of the entire Pipeline mixed two different questions:

1. Is the problem coherent enough that PMO can design without reconstructing intent?
2. Has PMO finished design, stakeholder reconciliation, and a launch packet so implementation may start?

When those questions share one queue, a drafted design looks like launched work, and a four-band P1–P4 label looks like importance instead of work order. Capacity bands of four P1s also hide true sequence once the portfolio is larger than four concurrent parents.

## Engineering as a gate, not a second PMO

Engineering exists so PMO does not inherit a slogan. The gate asks for a coherent problem statement and remediation objectives or design direction. It does not ask for the final detailed design, the child graph, or the launch packet. Those remain Pipeline work because they require PMO sequencing, stakeholder feedback, and graduation review.

`team:engineering` therefore means “still qualifying.” Once the minimum qualification exists, the project leaves Engineering and enters PMO Pipeline at Initial Idea. Leaving the Engineering label on a Pipeline parent would keep a second owner after PMO already accepted the problem.

## Pipeline is preparation; Active is implementation

Pipeline stages describe preparation maturity: idea, drafted design, launch-packet work, then Graduation Candidate. None of those stages authorizes start-to-finish implementation. Sandbox or Development spikes that reduce design uncertainty do not make the parent Active. Only explicit Project Graduation moves a parent to Active, assigns an Active ordered position, and names one implementation owner for the approved packet.

That split preserves protected Product, Production, credential, and separation-of-duty decisions. Lifecycle stage never weakens those stops.

## Priority as order, not severity

A four-level severity model cannot represent “this is the twelfth Pipeline project to prepare.” Pipeline Priority 1...XXX and Active Priority 1...XXX are independent ordered sequences. Number 1 is the next position in that lifecycle queue. The same integer in Pipeline and Active does not mean the same work, because the queues are separate.

Renumbering after add, remove, hold, close, or reprioritize keeps the sequence readable. Stage still answers what state the project is in; priority answers when it is worked relative to peers in the same lifecycle.

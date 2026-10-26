# Project Knowledge Base

Use this folder to understand FactoryShark's design and maintain its behavior. For installation and everyday factory usage, start with the [README](/README.md). Development and release commands live in [CONTRIBUTING.md](/CONTRIBUTING.md).

- [Factory evaluation](/docs/architecture/factory-evaluation.md): generation, association persistence, parameter precedence, hooks, and ownership boundaries.
- [Why a Sequelize-specific factory](/docs/decisions/sequelize-factory-design.md): the problem behind the design, the familiar Fishery interface, and the name.
- [Consumer verification](/docs/qa-scenarios/package-consumer.md): what the isolated scenarios and installed-package smoke prove.

## Keeping This Knowledge Useful

Before changing behavior, read its owning document and the corresponding implementation. When work establishes a durable design decision, changes a supported contract, or reveals a reusable QA requirement, update the existing document in the same pull request. Add a new page only when a distinct reader question has no owner, and link it here.

Describe what consumers can rely on and why. Cite public repository-local source and scenarios where they help a maintainer verify the explanation. Documentation records intended behavior; source shows the implementation; executed checks provide evidence. Resolve disagreements explicitly rather than silently changing the documented contract.

Keep run logs, temporary diagnoses, check results, and release progress in the issue, pull request, or session—not this folder. Keep coding conventions and command instructions in their existing owners instead of copying them into each page.

## Publication Boundary

Everything here is public repository documentation. Use WRAP's general name for its origin; do not include private repository links, source revisions, internal application details, credentials, or workstation paths. There is no separate documentation-site publishing process. Knowledge-base changes are reviewed with the same issue-linked pull requests as code changes.

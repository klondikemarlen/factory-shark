# Why a Sequelize-Specific Factory

## Need

FactoryShark grew out of using Fishery for Sequelize tests in WRAP. Nested association creation needed to behave more like factory_bot does for Rails: creating a record should also create its declared dependencies and propagate their foreign keys in the right order.

## Decision

The factory implementation was rebuilt from the ground up for Sequelize's association and persistence model. It deliberately mirrors Fishery's interface wherever possible so defining attributes, using sequences and transient parameters, and configuring factories feel familiar.

This is a design direction, not a promise of drop-in Fishery or factory_bot compatibility. The supported association contract today is `belongsTo`, with `id` primary keys. See [factory evaluation](/docs/architecture/factory-evaluation.md) for ordering, overrides, hooks, and persistence boundaries. Supporting other associations requires a separate behavioral design rather than treating them as automatically compatible.

Keep reusable model factories in the consuming application's tests. The library owns evaluation and persistence mechanics; application-owned factories own meaningful defaults, optional relationship helpers, and domain-specific setup.

## Name

The project was originally called fishery-bot. The [README's naming explanation](/README.md#name) uses a robotic shark produced by FactoryBot eating Fishery: Fishery-inspired factory definitions meet factory_bot-inspired association handling.

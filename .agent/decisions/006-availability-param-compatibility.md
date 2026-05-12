# 006 Availability Param Compatibility

## Decision

`get-availability` accepts both `shop_slug` and `slug`, and clients may send both while old deployed bundles or callers still exist.

## Context

The customer app used `shop_slug`, but the deployed edge function expected `slug`, producing a required-params error before slots rendered. Web/customer clients and the edge function need a compatibility window because app bundles and edge deployments can be out of sync.

## Consequences

- New code should prefer `shop_slug` for clarity.
- `slug` remains a compatibility alias at the edge boundary.
- Server-side service/shop validation still determines the actual shop context; the duplicate param is not a second source of truth.

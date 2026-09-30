// Barrel: the admin helpers/components live in ./shared-parts/*, split by
// feature so a route only downloads the parts it actually imports (Rollup
// tree-shakes `export *`). Import from '@/lib/shared' as before.
export * from './shared-parts/ui';
export * from './shared-parts/shell';
export * from './shared-parts/misc';
export * from './shared-parts/students';
export * from './shared-parts/payments';
export * from './shared-parts/structure';
export * from './shared-parts/bank';
export * from './shared-parts/auth';
export * from './shared-parts/groups';

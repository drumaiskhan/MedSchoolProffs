// Barrel: the admin helpers/components live in ./shared-parts/*, split by
// feature so a route only downloads the parts it actually imports (Rollup
// tree-shakes `export *`). Import from '@/lib/shared' as before.
export * from './shared-parts/ui';
export * from './shared-parts/trial';
export * from './shared-parts/practice';
export * from './shared-parts/shell';
export * from './shared-parts/home';
export * from './shared-parts/payments';
export * from './shared-parts/marketing';
export * from './shared-parts/auth';
export * from './shared-parts/content';

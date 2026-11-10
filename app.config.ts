import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the production app (the EAS builds). `APP_VARIANT=development` (set by
// `npm start` / `npm run android`) gives the dev build its own package and name, derived from
// app.json's, so it installs next to the production APK instead of replacing it
// (ARCHITECTURE.md § Distribution).
export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, slug, android } = config;

  if (!name || !slug || !android?.package) {
    throw new Error('app.json needs expo.name, expo.slug and expo.android.package');
  }

  if (process.env.APP_VARIANT !== 'development') return { ...config, name, slug };

  return {
    ...config,
    name: `${name} Dev`,
    slug,
    android: { ...android, package: `${android.package}.dev` },
  };
};

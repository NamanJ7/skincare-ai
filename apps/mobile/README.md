# Pore — mobile app

Expo (SDK 56) / React Native app using Expo Router. Styling is plain
`StyleSheet` driven by the shared design tokens in `@pore/shared` — there is no
NativeWind here, so `className` does nothing on RN components.

> Expo changes fast. Check the versioned docs at
> https://docs.expo.dev/versions/v56.0.0/ before writing Expo code rather than
> relying on memory. See `AGENTS.md`.

## Develop

```bash
pnpm --filter @pore/mobile start      # expo start
pnpm --filter @pore/mobile ios        # or android / web
pnpm --filter @pore/mobile typecheck
```

Set `EXPO_PUBLIC_API_URL` (e.g. your dev machine's LAN IP, `http://192.168.1.20:3000`)
to hit the real `/api/plan` pipeline. When it is unset or unreachable, the app
falls back to a local safety-engine demo so the flow always works.

## Over-the-air updates

`expo-updates` is installed and configured in `app.json`, so JavaScript and
asset changes can reach installed apps without a store review.

**One setup step remains, and it needs your Expo account.** The update URL
embeds an EAS project id that only Expo can mint:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init              # writes extra.eas.projectId
npx eas-cli@latest update:configure  # writes updates.url
```

After that:

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest update --branch production -m "what changed"
```

### What OTA can and cannot ship

Updates carry **JS and assets only**. Anything that changes native code needs a
new build submitted to the stores:

- adding a native dependency (`expo-camera`, `expo-image-picker`, …)
- changing permission strings or anything else in `app.json` native config
- upgrading the Expo SDK

`runtimeVersion` uses the `fingerprint` policy, which hashes the native
dependency set. An update built against different native code is simply not
delivered to an incompatible binary, rather than shipping and crashing.

Update channels map to build profiles in `eas.json`: `development`, `preview`,
`production`.

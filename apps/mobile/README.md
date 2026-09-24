# Friday Archive mobile prototype

This is an independent Expo / React Native prototype of the Archive page. It does not replace or modify the existing Friday web app. The seven sample folders are local display data; there is no backend, login, real save action, or voice recognition yet.

## Run on an iPhone

From `apps/mobile`:

```sh
npm install
npm start
```

Install Expo Go from the iPhone App Store, keep the phone and computer on the same Wi-Fi network, then scan the QR code shown by Expo. This prototype intentionally uses Expo SDK 54, the version supported by the App Store iOS Expo Go build. Sign in to the same free Expo account in Expo CLI (`npx expo login`) and Expo Go if prompted. If local network discovery fails, run `npm start -- --tunnel` and scan the new QR code. The Archive screen opens directly.

Drag the folder stream or the green arc left/right. The folders follow the finger continuously, then settle on the nearest folder after release. The focused folder turns green; the information card and input placeholder update after it settles. The attachment, microphone, back, filter, search, and details controls are visual placeholders in this prototype.

## iPhone 16 Pro simulator

The iOS Simulator requires macOS with Xcode. On a Mac, install Xcode and an iPhone 16 Pro simulator, run `npm install` and `npm run ios` from this directory, then select the iPhone 16 Pro simulator. On Windows, test on a physical iPhone through Expo Go; an iOS Simulator is not available locally.

## Checks

```sh
npm run typecheck
npm run test:logic
npx expo export --platform ios
```

The last command checks that the iOS bundle can be built; it is not a substitute for testing on a device or simulator.

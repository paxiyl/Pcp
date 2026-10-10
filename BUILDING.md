# Building OnlineMall

Three apps, built independently. Every command below was run against this
tree; where something does not work yet, it says so rather than pretending.

## Prerequisites

- **Node** 22+ and npm 10+.
- **JDK 21** — Android only.
- **Android SDK** — Android only. See [Android SDK](#android-sdk).

Each app keeps its own `package.json`; there is no workspace root, so install
in each directory you intend to build.

## api

```bash
cd api
npm install
npm run typecheck     # tsc --noEmit
npm run build         # typecheck, then tsup bundles to dist/
npm run dev           # nodemon + tsx, watching src/
```

`npm start` runs `dist/index.js`. It needs the environment to be set — it
exits immediately on a missing `MONGODB_URI`, which is the first variable
`src/config/env.config.ts` asks for.

Seeds, once the database is reachable:

```bash
npm run seed:categories
npm run seed:restaurants
npm run seed:stores
npm run seed:admin
npm run seed:driver
npm run seed:banners
```

TypeScript is pinned to 7.x, which **removed `moduleResolution: "node10"`**.
The usual `module: commonjs` pairing no longer compiles; `tsconfig.json` uses
`nodenext`, which still emits CommonJS because `package.json` declares
`"type": "commonjs"`. The dev runner is `tsx`, not `ts-node` — ts-node is
incompatible with TypeScript 7.

## admin

```bash
cd admin
npm install
npm run dev           # vite, port 5173
npm run build         # tsc -b, then vite build
npm run lint          # oxlint
```

`VITE_API_URL` overrides the API base. Without it the app uses
`http://localhost:8000/api/v1` in development and `/api/v1` in production.

## mobile

```bash
cd mobile
npm install
npx tsc --noEmit      # no "typecheck" script; this is the equivalent
npm start             # expo start
```

### Android SDK

Not needed for `expo start` against Expo Go or a dev client, only for
building the native app locally.

```bash
SDK=/opt/android-sdk
mkdir -p "$SDK/cmdline-tools"
curl -sSL -o /tmp/cmdline-tools.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
unzip -q /tmp/cmdline-tools.zip -d "$SDK/cmdline-tools"
mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"

export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --licenses
"$SDK/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

The NDK and CMake are pulled in automatically by the Gradle build once the
licences are accepted, so they are not listed above.

### Checking everything still works

```bash
cd api
npm install --no-save mongodb-memory-server   # once; downloads a MongoDB binary
npm run check
```

Eight suites against a throwaway database, about three minutes. They are not a
unit-test suite — there is no runner and no coverage goal. They cover the two
things reading the code cannot catch:

- **Arithmetic and flows that move money or grant access.** Registration as
  each role, admin approval granting it, the cash ledger, order status hooks.
- **Bug classes that typecheck perfectly.** A field declared on a model
  interface but missing from the Mongoose schema (silently dropped on every
  write). A value-import cycle (crashes depending on which module loads
  first). A filter operator not marked `mongoose.trusted` (matches nothing,
  reports success). `api.check.mjs` boots the real server and calls every
  endpoint, because the API's response shape and the clients' types live in
  different codebases and agree only by hand.

Run it before a release, and after touching a model, a controller's response
shape, or anything under `src/scripts/`.

### Building the APK

```bash
cd mobile
export ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
npx expo prebuild --platform android --clean
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties

# R8 needs more heap than the template gives it. See below.
sed -i 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=1024m/' gradle.properties
sed -i 's/^reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' gradle.properties

./gradlew assembleRelease
```

`android/` is generated and git-ignored: prebuild rewrites it from `app.json`,
so edit the config, never the generated project. Which also means the two
`sed` lines above have to be re-applied after **every** `prebuild --clean` —
they are in the generated file, not in `app.json`, because
`expo-build-properties` exposes no option for either.

### `minifyReleaseWithR8` fails with "Java heap space"

The template ships `org.gradle.jvmargs=-Xmx2048m`, which is not enough for R8
to shrink a release build with this many libraries. It fails ~17 minutes in,
after everything else has already compiled, so it is an expensive way to find
out. Raise it to 8 GB as above.

Do **not** set `JAVA_TOOL_OPTIONS=-Xmx...` instead. It applies to every JVM the
build starts, including R8's worker, so it silently *overrides* whatever
`org.gradle.jvmargs` says and caps the one process that needs the memory most.

Release is signed with the **debug keystore**, which is the React Native
template's default. The APK installs and runs, and it is not publishable to
Play. For a real release, generate a keystore, keep it out of the repository,
and point `signingConfigs.release` at it — losing it means never being able to
update the app.

`reactNativeArchitectures` is narrowed to `arm64-v8a`, which is every Android
phone sold in India for years. Adding `armeabi-v7a` serves genuinely old
hardware; the two x86 slices serve only emulators and roughly double the
native build.

### If Gradle fails on dependency resolution

Maven Central rate-limits shared egress IPs with **HTTP 429**, and Gradle then
disables that repository for the whole build. Google hosts a read-only mirror.
Adding it through `~/.gradle/init.d/` keeps the project untouched:

```groovy
def mirror = "https://maven-central.storage-download.googleapis.com/maven2"

settingsEvaluated { settings ->
  settings.pluginManagement {
    repositories {
      maven { url mirror }
      gradlePluginPortal()   // declaring any repository drops the implicit default
      google()
      mavenCentral()
    }
  }
}

allprojects {
  buildscript { repositories { maven { url mirror } } }
  repositories { maven { url mirror } }
}
```

Listing `gradlePluginPortal()` explicitly matters: declaring any repository in
`pluginManagement` removes Gradle's implicit default, and plugins such as
`com.diffplug.spotless` then cannot be found.

### EAS

`eas.json` has three profiles — `preview` builds an APK, `production` an app
bundle. Neither runs until `eas init` fills in the blank
`extra.eas.projectId` in `app.json`, which needs an Expo account.

## Known gaps

- **Artwork is placeholder.** Every image under `mobile/assets/images`,
  `mobile/src/assets/images` and `admin/src/assets/login-bg-img.png` was drawn
  to unblock the build, not designed. Replace before release.
- **Online payment does not work on device.** `react-native-razorpay` is not a
  dependency; `src/features/orders/payment-sheet.ts` holds the implementation
  in a comment behind a working seam. A Razorpay checkout returns a stated
  failure and cash on delivery works. Installing it changes the native build,
  so it is a deliberate choice, not an oversight.
- `expo-haptics` and `expo-notifications` are likewise absent and unreferenced.
- `mobile/package.json` has a `reset-project` script whose
  `scripts/reset-project.js` is not in the tree.
- No lockfiles are committed, so installs are not reproducible.
- Pharmacy licensing has to be settled before any prescription medicine is
  sold. `requiresPrescription` exists and the API refuses to basket those
  products; that is a guard, not compliance.

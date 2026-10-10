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

After an index definition changes, once:

```bash
npm run sync:indexes
```

The app does not do this on boot. `autoIndex` runs `createIndexes`, which only
ADDS — it cannot replace an index whose definition changed, and when the change
collides with an existing name MongoDB refuses it outright
(`IndexKeySpecsConflict`), logs the refusal among the startup lines, and leaves
the old index in place with the new rule unenforced. `syncIndexes` DROPS
anything not in the schema, which is why it is a deliberate command: an index
added by hand against a live performance problem would go with it. It prints
what it dropped and exits non-zero on failure.

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

Twelve suites, a little over 300 assertions, about three minutes. They are not
a unit-test suite — there is no runner and no coverage goal. They cover the
three things reading the code cannot catch:

- **Arithmetic and flows that move money or grant access.** Registration as
  each role, admin approval granting it, the cash ledger, order status hooks.
  `money.check.mjs` runs a typed rupee figure into paise and back out as a price
  tag, round trip included.
- **Bug classes that typecheck perfectly.** A field declared on a model
  interface but missing from the Mongoose schema (silently dropped on every
  write). A value-import cycle (crashes depending on which module loads
  first). A filter operator not marked `mongoose.trusted` (matches nothing,
  reports success). `api.check.mjs` boots the real server and calls every
  endpoint, and `route-coverage.check.mjs` compares the API's route table
  against every path the two clients call, because those halves live in
  different codebases and agree only by hand.
- **Decisions that only run on a phone.** Three of the suites read `mobile/`
  rather than the API, because the code they cover was unreachable from here:
  where the app sends each role after signing in, whether a customer can pay at
  all, and money crossing the keyboard. All three were inline expressions inside
  hooks and screens; they are plain functions in import-free modules now, and
  these suites call them.

Run it before a release, and after touching a model, a controller's response
shape, a client path, or anything under `src/scripts/`.

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

## Updating a running deployment

The API and the app are deployed separately, and most fixes live in the API —
so a new APK against an old API will still show the old behaviour. Update the
API first.

### The API

```bash
cd ~/Pcp
git pull origin ccr-94280ad2-b9zwbq
cd api
npm install            # dist/ is built here, and that needs the devDependencies
npm run bundle         # tsup only — see the note below
```

**`dist/` is git-ignored, so it never arrives from a pull.** `npm start` runs
`node dist/index.js`, so skipping the build step gives

```
Error: Cannot find module '.../api/dist/index.js'
```

and the app then reports "Can't reach Raket", because the API connects to
MongoDB before it starts listening — a process that never started looks exactly
like a server that is down.

Use `npm run bundle` rather than `npm run build` on a phone. `build` runs
`tsc --noEmit` first, which is the slow and memory-hungry half and can be
killed by Android before it finishes; `bundle` just emits. Run the typecheck on
a real machine, where `npm run build` is the right command.

Then restart it. In Termux, where it runs under `nohup`:

```bash
pkill -f "node dist/index.js"
nohup npm start > ~/raket-api.log 2>&1 &
sleep 3 && tail -5 ~/raket-api.log      # should say the database connected
```

No `npm install` is needed unless `api/package.json` gained a dependency —
check `git log -p -- api/package.json` if in doubt. Adding a script does not
count.

### The backoffice

```bash
cd ~/Pcp/admin
npm run build
npm run preview        # serves dist/ with the SPA fallback
```

`npm run preview`, not `npx serve dist` — a plain static server returns 404 on
`/login` and every other client-side route.

### Clearing the seeded demo catalogue

```bash
cd ~/Pcp/api
npm run reset:demo
```

Drops the seeded shops, kitchens, products, dishes, banners, orders and
baskets. **Keeps** your users (so the admin login still works), the category
taxonomy (so real products have shelves from day one), and the platform
settings. Owners are unlinked rather than deleted, because their past orders
reference the account.

Then optionally:

```bash
npm run seed:categories     # the category strips, if you cleared them
npm run seed:restaurants    # six example Hindaun kitchens
npm run seed:stores         # one example kirana with real stock
```

Skip the last two to start with an empty catalogue and enter real shops
through the backoffice.

## Known gaps

- **Artwork is placeholder.** Every image under `mobile/assets/images`,
  `mobile/src/assets/images` and `admin/src/assets/login-bg-img.png` was drawn
  to unblock the build, not designed. Replace before release.
- **Online payment does not work on device yet.** `react-native-razorpay` is
  not a dependency; `mobile/src/features/orders/payment-sheet.ts` holds the
  implementation in a comment behind a working seam. Installing it changes the
  native build, so it is a deliberate choice, not an oversight:

      cd mobile
      npx expo install react-native-razorpay
      npx expo prebuild --platform android --clean   # native module

  then fill in `openRazorpaySheet`, and set `RAZORPAY_INSTALLED = true` in
  `src/features/payments/availability.ts`. Nothing else changes — every call
  site already asks whether a sheet can be opened rather than assuming.

  Until then the app does not offer what it cannot finish. UPI, card,
  netbanking and wallet are greyed out with a reason on both the settings
  screen and checkout, and cash on delivery is the default for a customer who
  has never chosen. The server half is the same question asked of
  configuration: with no `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (or
  `PAYMENT_PROVIDER=stripe` and the Stripe pair), `GET /payment-methods`
  reports `online.available: false` and the app believes it. Set both halves
  and online payment appears with no further change.
- `expo-haptics` and `expo-notifications` are likewise absent and unreferenced.
- `mobile/package.json` has a `reset-project` script whose
  `scripts/reset-project.js` is not in the tree.
- No lockfiles are committed, so installs are not reproducible.
- Pharmacy licensing has to be settled before any prescription medicine is
  sold. `requiresPrescription` exists and the API refuses to basket those
  products; that is a guard, not compliance.

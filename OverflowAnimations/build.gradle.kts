@file:Suppress("UnstableApiUsage", "PropertyName")

import org.polyfrost.gradle.util.noServerRunConfigs
import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar

// Adds support for kotlin, and adds the Polyfrost Gradle Toolkit
// which we use to prepare the environment.
plugins {
    kotlin("jvm")
    id("org.polyfrost.multi-version")
    id("org.polyfrost.defaults.repo")
    id("org.polyfrost.defaults.java")
    id("org.polyfrost.defaults.loom")
    id("com.github.johnrengelman.shadow")
    id("net.kyori.blossom") version "1.3.2"
    id("signing")
    java
}

// Must match the Kotlin plugin version applied in `root.gradle.kts`, since the bundled
// runtime has to be the one the mod's classes were compiled against.
val kotlinVersion = "1.9.10"

// Gets the mod name, version and id from the `gradle.properties` file.
val mod_name: String by project
val mod_version: String by project
val mod_id: String by project
val mod_archives_name: String by project

// Replaces the variables in `ExampleMod.java` to the ones specified in `gradle.properties`.
blossom {
    replaceToken("@VER@", mod_version)
    replaceToken("@NAME@", mod_name)
    replaceToken("@ID@", mod_id)
}

// Sets the mod version to the one specified in `gradle.properties`. Make sure to change this following semver!
version = mod_version
// Sets the group, make sure to change this to your own. It can be a website you own backwards or your GitHub username.
// e.g. com.github.<your username> or com.<your domain>
group = "org.polyfrost"

// Sets the name of the output jar (the one you put in your mods folder and send to other people)
// It outputs all versions of the mod into the `build` directory.
base {
    archivesName.set("$mod_archives_name-$platform")
}

// Configures the Polyfrost Loom, our plugin fork to easily set up the programming environment.
loom {
    // Removes the server configs from IntelliJ IDEA, leaving only client runs.
    // If you're developing a server-side mod, you can remove this line.
    noServerRunConfigs()

    // Legacy Forge needs a tweaker to bootstrap Mixin. This build ships Mixin itself rather
    // than letting OneConfig's loader fetch it, so Mixin's own tweaker is used.
    if (project.platform.isLegacyForge) {
        runConfigs {
            "client" {
                programArgs("--tweakClass", "org.spongepowered.asm.launch.MixinTweaker")
                property("fml.coreMods.load", "org.polyfrost.overflowanimations.ModDetectorPlugin")
                property("mixin.debug.export", "true")
            }
        }
    }
    // Configures the mixins if we are building for forge, useful for when we are dealing with cross-platform projects.
    if (project.platform.isForge) {
        forge {
            mixinConfig("mixins.${mod_id}.json")
        }
    }
    // Configures the name of the mixin "refmap" using an experimental loom api.
    mixin.defaultRefmapName.set("mixins.${mod_id}.refmap.json")
}

// Creates the shade/shadow configuration, so we can include libraries inside our mod, rather than having to add them separately.
val shade: Configuration by configurations.creating {
    configurations.implementation.get().extendsFrom(this)
}

// Configures the output directory for when building from the `src/resources` directory.
sourceSets {
    val dummy by creating
    main {
        dummy.compileClasspath += compileClasspath
        compileClasspath += dummy.output
        output.setResourcesDir(java.classesDirectory)
    }
}

// Adds the Polyfrost maven repository, which mirrors the Mixin build legacy Forge needs.
repositories {
    maven("https://repo.polyfrost.org/releases")
    maven("https://repo.spongepowered.org/repository/maven-public/")
}

// Configures the libraries/dependencies for your mod.
dependencies {
    modRuntimeOnly("me.djtheredstoner:DevAuth-${if (platform.isFabric) "fabric" else if (platform.isLegacyForge) "forge-legacy" else "forge-latest"}:1.1.2")

    if (platform.isLegacyForge) {
        // Mixin used to arrive with OneConfig's loader. It is bundled directly now, together
        // with the tweaker entry in the jar manifest that registers our mixin config.
        // Non-transitive: Mixin's POM asks for Guava, Gson, commons-io, log4j and ASM, all of
        // which Minecraft and Forge already provide. Bundling them would bloat the jar and
        // risk shadowing the versions the game expects (Mixin's own ASM is repackaged inside).
        shade("org.spongepowered:mixin:0.7.11-SNAPSHOT") { isTransitive = false }

        // OneConfig also supplied the Kotlin runtime; without it the mod has to carry its own.
        // Since Kotlin 1.8 the jdk7/jdk8 split is folded into kotlin-stdlib, so this is complete.
        // Keep the version in step with the Kotlin plugin in `root.gradle.kts`.
        shade("org.jetbrains.kotlin:kotlin-stdlib:$kotlinVersion") { isTransitive = false }
    }
}

tasks {
    // Processes the `src/resources/mcmod.info or fabric.mod.json` and replaces
    // the mod id, name and version with the ones in `gradle.properties`
    processResources {
        inputs.property("id", mod_id)
        inputs.property("name", mod_name)
        val java = if (project.platform.mcMinor >= 18) {
            17 // If we are playing on version 1.18, set the java version to 17
        } else {
            // Else if we are playing on version 1.17, use java 16.
            if (project.platform.mcMinor == 17)
                16
            else
                8 // For all previous versions, we **need** java 8 (for Forge support).
        }
        val compatLevel = "JAVA_${java}"
        inputs.property("java", java)
        inputs.property("java_level", compatLevel)
        inputs.property("version", mod_version)
        inputs.property("mcVersionStr", project.platform.mcVersionStr)
        filesMatching(listOf("mcmod.info", "mixins.${mod_id}.json", "mods.toml")) {
            expand(
                mapOf(
                    "id" to mod_id,
                    "name" to mod_name,
                    "java" to java,
                    "java_level" to compatLevel,
                    "version" to mod_version,
                    "mcVersionStr" to project.platform.mcVersionStr
                )
            )
        }
        filesMatching("fabric.mod.json") {
            expand(
                mapOf(
                    "id" to mod_id,
                    "name" to mod_name,
                    "java" to java,
                    "java_level" to compatLevel,
                    "version" to mod_version,
                    "mcVersionStr" to project.platform.mcVersionStr.substringBeforeLast(".") + ".x"
                )
            )
        }
    }

    // Configures the resources to include if we are building for forge or fabric.
    withType(Jar::class.java) {
        if (project.platform.isFabric) {
            exclude("mcmod.info", "mods.toml")
        } else {
            exclude("fabric.mod.json")
            if (project.platform.isLegacyForge) {
                exclude("mods.toml")
            } else {
                exclude("mcmod.info")
            }
        }
    }

    // Configures our shadow/shade configuration, so we can
    // include some dependencies within our mod jar file.
    named<ShadowJar>("shadowJar") {
        archiveClassifier.set("dev") // TODO: machete gets confused by the `dev` prefix.
        configurations = listOf(shade)
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
        // Mixin's jar is signed; its signature files would be invalid once repackaged here.
        exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA", "META-INF/MUMFREY.*")
        exclude("META-INF/services/javax.annotation.processing.Processor")
        exclude("META-INF/services/org.spongepowered.tools.obfuscation.service.IObfuscationService")
    }

    remapJar {
        inputFile.set(shadowJar.get().archiveFile)
        archiveClassifier.set("")
    }

    jar {
        // Sets the jar manifest attributes.
        if (platform.isLegacyForge) {
            manifest.attributes += mapOf(
                "ModSide" to "CLIENT", // We aren't developing a server-side mod, so this is fine.
                "ForceLoadAsMod" to true, // We want to load this jar as a mod, so we force Forge to do so.
                "FMLCorePluginContainsFMLMod" to "Yes, yes it does",
                "FMLCorePlugin" to "org.polyfrost.overflowanimations.ModDetectorPlugin",
                "TweakOrder" to "0", // Makes sure Mixin is bootstrapped as soon as possible.
                "MixinConfigs" to "mixins.${mod_id}.json", // Read by Mixin's FML platform agent.
                // Must be exactly this class: Mixin scans the classpath for jars whose TweakClass
                // is its own tweaker, and only those get their MixinConfigs registered.
                "TweakClass" to "org.spongepowered.asm.launch.MixinTweaker"
            )
        }
        dependsOn(shadowJar)
        archiveClassifier.set("")
        enabled = false
    }
}
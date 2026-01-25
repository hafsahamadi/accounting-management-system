plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin") // Toujours après android & kotlin
}

android {
    namespace = "com.example.flutter_application_1" // This is your app's namespace
    compileSdk = 35 // Using a preview SDK (Android VanillaIceCream / API 35). Ensure you have it installed.
                  // Consider using flutter.compileSdkVersion if defined in local.properties or a stable version like 34.

    defaultConfig {
        applicationId = "com.example.flutter_application_1"
        minSdk = 21 // Or flutter.minSdkVersion
        targetSdk = 35 // Or flutter.targetSdkVersion
        versionCode = 1 // Or flutterVersionCode.toInteger()
        versionName = "1.0" // Or flutterVersionName
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildTypes {
        release {
            // ⚠️ Pour un vrai release, utilise un keystore personnel ici
            signingConfig = signingConfigs.getByName("debug") // This is fine for debug, but change for release
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."  // Répertoire Flutter racine
}

dependencies { // Add this block if not present, ensure kotlin-stdlib is there
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.23") // Match your Kotlin plugin version
    // Other dependencies...
}
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

val moaAppUrl = providers.gradleProperty("MOA_APP_URL").orElse("https://example.invalid").get()

android {
    namespace = "com.moa.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.moa.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.1"
        buildConfigField("String", "MOA_APP_URL", "\"" + moaAppUrl + "\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
}

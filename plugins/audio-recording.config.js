// Expo config plugin to enable background audio recording capabilities
// iOS: UIBackgroundModes 'audio', NSMicrophoneUsageDescription, AVAudioSession category = record
// Android: RECORD_AUDIO, FOREGROUND_SERVICE(+_MICROPHONE) permissions, default notification channel

const {
  withInfoPlist,
  withAndroidManifest,
  withAppDelegate,
  withMainApplication,
} = require("@expo/config-plugins");

const DEFAULTS = {
  iosMicrophoneUsageDescription:
    "This app uses the microphone to record audio during meetings.",
  androidChannelId: "recording",
  androidChannelName: "Recording",
  androidChannelDescription: "Foreground service for microphone recording",
};

function uniquePush(arr, value) {
  const next = Array.isArray(arr) ? arr.slice() : [];
  if (!next.includes(value)) next.push(value);
  return next;
}

function ensurePermission(manifest, name) {
  const uses = manifest.manifest["uses-permission"] || [];
  const exists = uses.some((item) => item?.$?.["android:name"] === name);
  if (!exists) {
    uses.push({ $: { "android:name": name } });
    manifest.manifest["uses-permission"] = uses;
  }
}

function ensureMetaData(application, name, value) {
  const meta = application["meta-data"] || [];
  const existing = meta.find((m) => m?.$?.["android:name"] === name);
  if (existing) {
    existing.$["android:value"] = value;
  } else {
    meta.push({ $: { "android:name": name, "android:value": value } });
  }
  application["meta-data"] = meta;
}

const withIOSBackgroundAudio = (config, options) =>
  withInfoPlist(config, (config) => {
    const plist = config.modResults;
    plist.UIBackgroundModes = uniquePush(plist.UIBackgroundModes, "audio");
    const key = "NSMicrophoneUsageDescription";
    plist[key] =
      options.iosMicrophoneUsageDescription ||
      plist[key] ||
      DEFAULTS.iosMicrophoneUsageDescription;
    return config;
  });

const withIOSAudioSessionCategory = (config) =>
  withAppDelegate(config, (config) => {
    let { language, contents } = config.modResults;
    // Objective-C: AppDelegate.m
    if (language === "objc") {
      if (!contents.includes("AVAudioSessionCategoryRecord")) {
        if (!contents.includes("#import <AVFoundation/AVFoundation.h>")) {
          contents = contents.replace(
            '#import "AppDelegate.h"',
            '#import "AppDelegate.h"\n#import <AVFoundation/AVFoundation.h>',
          );
        }
        const injection = `\n  AVAudioSession *session = [AVAudioSession sharedInstance];\n  NSError *setCategoryError = nil;\n  [session setCategory:AVAudioSessionCategoryRecord mode:AVAudioSessionModeDefault options:0 error:&setCategoryError];\n  if (setCategoryError) {\n    NSLog(@"Error setting AVAudioSession category: %@", setCategoryError);\n  }\n`;
        contents = contents.replace(
          /didFinishLaunchingWithOptions:[\s\S]*?return YES;/,
          (match) =>
            match.includes("AVAudioSessionCategoryRecord")
              ? match
              : match.replace("return YES;", injection + "  return YES;"),
        );
      }
    }
    // Swift: AppDelegate.swift
    if (language === "swift") {
      if (
        !contents.includes(
          "AVAudioSession.sharedInstance().setCategory(.record",
        )
      ) {
        if (!contents.includes("import AVFoundation")) {
          contents = contents.replace(
            "import UIKit",
            "import UIKit\nimport AVFoundation",
          );
        }
        const injection = `\n    do {\n      try AVAudioSession.sharedInstance().setCategory(.record, mode: .default, options: [])\n    } catch {\n      NSLog("Error setting AVAudioSession category: \\u{28}error\\u{29}")\n    }\n`;
        contents = contents.replace(
          /didFinishLaunchingWithOptions[\s\S]*?return true/,
          (match) =>
            match.includes(
              "AVAudioSession.sharedInstance().setCategory(.record",
            )
              ? match
              : match.replace("return true", injection + "        return true"),
        );
      }
    }
    config.modResults.contents = contents;
    return config;
  });

const withAndroidAudioPermissions = (config, options) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensurePermission(manifest, "android.permission.RECORD_AUDIO");
    ensurePermission(manifest, "android.permission.FOREGROUND_SERVICE");
    // Android 14+ specific foreground service microphone permission
    ensurePermission(
      manifest,
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    );

    const app = manifest.manifest.application?.[0];
    if (app) {
      // Expo Notifications: default channel id used when not specified
      ensureMetaData(
        app,
        "expo.modules.notifications.default_notification_channel_id",
        options.androidChannelId || DEFAULTS.androidChannelId,
      );
    }
    return config;
  });

const withAndroidNotificationChannel = (config, options) =>
  withMainApplication(config, (config) => {
    const mainApp = config.modResults;
    const { language } = mainApp;
    let contents = mainApp.contents;

    const channelId = options.androidChannelId || DEFAULTS.androidChannelId;
    const channelName =
      options.androidChannelName || DEFAULTS.androidChannelName;
    const channelDesc =
      options.androidChannelDescription || DEFAULTS.androidChannelDescription;

    // Inject imports
    if (language === "java") {
      if (
        !contents.includes("NotificationChannel") ||
        !contents.includes("NotificationManager")
      ) {
        if (!contents.includes("import android.app.NotificationChannel")) {
          contents = contents.replace(
            /import android\.app\.Application;\n/,
            "import android.app.Application;\nimport android.app.NotificationChannel;\nimport android.app.NotificationManager;\nimport android.os.Build;\n",
          );
        }
      }
      // Inject channel creation in onCreate()
      if (!contents.includes(`new NotificationChannel("${channelId}"`)) {
        contents = contents.replace(
          /public void onCreate\(\) \{[\s\S]*?super\.onCreate\(\);/,
          (match) =>
            match +
            `\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n      NotificationManager notificationManager = getSystemService(NotificationManager.class);\n      if (notificationManager != null) {\n        NotificationChannel channel = new NotificationChannel("${channelId}", "${channelName}", NotificationManager.IMPORTANCE_LOW);\n        channel.setDescription("${channelDesc}");\n        notificationManager.createNotificationChannel(channel);\n      }\n    }\n`,
        );
      }
    }

    if (language === "kt") {
      if (
        !contents.includes("NotificationChannel") ||
        !contents.includes("NotificationManager")
      ) {
        if (!contents.includes("import android.app.NotificationChannel")) {
          contents = contents.replace(
            /import android\.app\.Application\n/,
            "import android.app.Application\nimport android.app.NotificationChannel\nimport android.app.NotificationManager\nimport android.os.Build\n",
          );
        }
      }
      if (!contents.includes(`NotificationChannel("${channelId}"`)) {
        contents = contents.replace(
          /override fun onCreate\(\) \{[\s\S]*?super\.onCreate\(\)/,
          (match) =>
            match +
            `\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n      val manager = getSystemService(NotificationManager::class.java)\n      manager?.createNotificationChannel(NotificationChannel("${channelId}", "${channelName}", NotificationManager.IMPORTANCE_LOW).apply {\n        description = "${channelDesc}"\n      })\n    }\n`,
        );
      }
    }

    mainApp.contents = contents;
    return config;
  });

const withAudioRecordingConfig = (config, opts = {}) => {
  const options = { ...DEFAULTS, ...opts };
  config = withIOSBackgroundAudio(config, options);
  config = withIOSAudioSessionCategory(config);
  config = withAndroidAudioPermissions(config, options);
  config = withAndroidNotificationChannel(config, options);
  return config;
};

module.exports = (config, props) => withAudioRecordingConfig(config, props);

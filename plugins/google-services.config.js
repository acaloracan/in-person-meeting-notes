// Simple config plugin to ensure google-services.json is present for Android.
// Copies from a configurable source into android/app/google-services.json
// and sets config.android.googleServicesFile accordingly.

const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withGoogleServices(config, props = {}) {
  const projectRoot = config._internal?.projectRoot || process.cwd();
  const source = props.source || "./google-services.json";
  const dest = props.dest || "android/app/google-services.json";

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const sourcePath = path.resolve(projectRoot, source);
      const destPath = path.resolve(projectRoot, dest);
      try {
        if (!fs.existsSync(sourcePath)) {
          throw new Error(
            `google-services.json not found at ${sourcePath}. Configure plugin 'source' or add the file.`,
          );
        }
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(sourcePath, destPath);
        console.log(
          `[google-services] Copied ${path.relative(projectRoot, sourcePath)} -> ${path.relative(projectRoot, destPath)}`,
        );

        config.android = config.android || {};
        config.android.googleServicesFile = `./${dest.replace(/\\/g, "/")}`;
      } catch (e) {
        console.warn(`[google-services] ${e.message}`);
      }
      return config;
    },
  ]);
}

module.exports = function (config, props) {
  return withGoogleServices(config, props);
};

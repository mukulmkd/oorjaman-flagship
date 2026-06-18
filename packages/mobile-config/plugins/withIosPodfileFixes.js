const { withPodfile } = require("expo/config-plugins");

const DEPLOYMENT_TARGET_MARKER =
  "Privacy bundles (RNViewShotPrivacyInfo, SDWebImage) ship podspec platform 9.0";

const FMT_CXX17_MARKER = "target.name == 'fmt'";

const DEPLOYMENT_TARGET_FIX = `
    # Privacy bundles (RNViewShotPrivacyInfo, SDWebImage) ship podspec platform 9.0; align with app minimum.
    min_ios = podfile_properties['ios.deploymentTarget'] || '16.4'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < min_ios.to_f
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
        end
      end
    end
`;

const FMT_CXX17_FIX = `
    # Xcode 26+ / Apple Clang 21: fmt consteval workaround (RN 0.81 fmt 11.x).
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

function appendAfterReactNativePostInstall(contents, snippet) {
  return contents.replace(
    /react_native_post_install\(\s*installer,\s*config\[:reactNativePath\],[\s\S]*?\)\n/,
    (block) => `${block}${snippet}`,
  );
}

/** Patches Podfile post_install for Xcode 26 fmt failures and legacy iOS 9 privacy bundles. */
function withIosPodfileFixes(config) {
  return withPodfile(config, (mod) => {
    let contents = mod.modResults.contents;
    const anchor = "react_native_post_install(\n      installer,\n      config[:reactNativePath],";
    if (!contents.includes(anchor)) {
      return mod;
    }

    if (!contents.includes(DEPLOYMENT_TARGET_MARKER)) {
      contents = appendAfterReactNativePostInstall(contents, DEPLOYMENT_TARGET_FIX);
    }
    if (!contents.includes(FMT_CXX17_MARKER)) {
      contents = appendAfterReactNativePostInstall(contents, FMT_CXX17_FIX);
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withIosPodfileFixes;

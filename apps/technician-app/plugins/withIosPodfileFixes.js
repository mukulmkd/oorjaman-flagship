const { withPodfile } = require("@expo/config-plugins");

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

/**
 * Patches generated Podfile post_install for Xcode 26 fmt build failures when
 * ios.buildReactNativeFromSource is enabled.
 */
function withIosPodfileFixes(config) {
  return withPodfile(config, (mod) => {
    const contents = mod.modResults.contents;
    if (contents.includes("target.name == 'fmt'")) {
      return mod;
    }
    const anchor = "react_native_post_install(\n      installer,\n      config[:reactNativePath],";
    if (!contents.includes(anchor)) {
      return mod;
    }
    mod.modResults.contents = contents.replace(
      /react_native_post_install\(\s*installer,\s*config\[:reactNativePath\],[\s\S]*?\)\n/,
      (block) => `${block}${FMT_CXX17_FIX}`,
    );
    return mod;
  });
}

module.exports = withIosPodfileFixes;

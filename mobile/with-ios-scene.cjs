const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const legacyStartup = /^#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)\n#endif$/m;
const windowDeclaration = '  var window: UIWindow?';

module.exports = (config) => {
  config = withAppDelegate(config, (mod) => {
    const { contents, language } = mod.modResults;
    if (contents.includes('final class LingDianSceneDelegate:')) return mod;
    if (language !== 'swift' || !legacyStartup.test(contents) || !contents.includes(windowDeclaration)) {
      throw new Error('The Expo AppDelegate template changed. Update the LingDian scene configuration before building.');
    }
    const sceneDelegate = readFileSync(join(__dirname, 'ios-scene-delegate.swift'), 'utf8');
    mod.modResults.contents = contents
      .replace(windowDeclaration, `${windowDeclaration}\n  var sceneLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?`)
      .replace(legacyStartup, '    sceneLaunchOptions = launchOptions')
      + '\n' + sceneDelegate;
    return mod;
  });

  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'LingDian',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).LingDianSceneDelegate',
        }],
      },
    };
    return mod;
  });
};

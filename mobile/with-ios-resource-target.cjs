const { withPodfile } = require('expo/config-plugins');

// CocoaPods resource bundles keep the podspec's target after React Native updates the library targets.
const resourceTargets = `    minimum_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || min_ios_version_supported)
    installer.pods_project.native_targets.each do |target|
      next unless target.product_type == 'com.apple.product-type.bundle'

      target.build_configurations.each do |configuration|
        settings = configuration.build_settings
        deployment_target = settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && Gem::Version.new(deployment_target) < minimum_ios
          settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s
        end
      end
    end`;

module.exports = (config) => withPodfile(config, (mod) => {
  const { contents } = mod.modResults;
  if (!contents.includes(resourceTargets)) {
    const postInstall = /^ {2}post_install do \|installer\|$/m;
    if (!postInstall.test(contents)) throw new Error('The Expo Podfile is missing the expected post_install hook.');
    mod.modResults.contents = contents.replace(postInstall, `$&\n${resourceTargets}\n`);
  }
  return mod;
});

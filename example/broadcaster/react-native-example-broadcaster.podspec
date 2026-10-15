require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-example-broadcaster"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/inthepocket/react-native-service-discovery"
  s.license      = "MIT"
  s.authors      = "In The Pocket"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :path => "." }
  s.source_files = "ios/**/*.{h,m}"

  s.dependency "React-Core"
end

const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    // Find if org.gradle.jvmargs is already present
    const jvmArgsItem = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );

    if (jvmArgsItem) {
      if (!jvmArgsItem.value.includes('-XX:-TieredCompilation')) {
        jvmArgsItem.value += ' -XX:-TieredCompilation';
      }
    } else {
      config.modResults.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: '-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:-TieredCompilation',
      });
    }

    return config;
  });
};

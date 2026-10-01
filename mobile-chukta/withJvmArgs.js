const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    const jvmArgsItem = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );

    const targetValue = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:-TieredCompilation';

    if (jvmArgsItem) {
      jvmArgsItem.value = targetValue;
    } else {
      config.modResults.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: targetValue,
      });
    }

    return config;
  });
};

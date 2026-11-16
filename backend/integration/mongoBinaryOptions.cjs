const fs = require('node:fs');

function getMongoBinaryOptions() {
  const configuredBinary = process.env.MONGOMS_SYSTEM_BINARY;
  if (configuredBinary) {
    const version = /[\\/]Server[\\/]7\.0[\\/]/i.test(configuredBinary) ? '7.0.0' : '8.0.4';
    return { binary: { systemBinary: configuredBinary, version } };
  }

  if (process.platform === 'win32') {
    const installedBinaries = [
      { path: 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe', version: '8.0.4' },
      { path: 'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe', version: '7.0.0' },
    ];
    const installedBinary = installedBinaries.find(({ path }) => fs.existsSync(path));
    if (installedBinary) {
      return {
        binary: {
          systemBinary: installedBinary.path,
          version: installedBinary.version,
        },
      };
    }
  }

  return { binary: { version: '8.0.4' } };
}

module.exports = getMongoBinaryOptions;

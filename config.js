// Lokale Konfiguration für h5p-cli, wird bei jedem h5p-Befehl aus diesem Ordner geladen.
const fs = require('fs');
const config = require(`${require.main.path}/config.js`);
const paket = require('./tools/moodle-paket.js');

// Die Eingriffe unten hängen an Interna von h5p-cli und sind nur mit dieser Version geprüft.
const GEPRUEFTE_VERSION = '1.1.6';
const installiert = require(`${require.main.path}/package.json`).version;
if (installiert !== GEPRUEFTE_VERSION) {
  console.error(`!!! h5p-cli ${installiert} ist installiert, geprüft ist ${GEPRUEFTE_VERSION}. Schnellspeichern, Import und Export können abweichen.`);
}

// Kein Live-Reload: Es lädt den Editor neu, sobald sich in libraries/ etwas ändert,
// dabei gehen ungespeicherte Eingaben verloren. Nur für Library-Entwicklung sinnvoll.
config.files.watch = false;

// Schnellspeichern (tools/schnellspeichern.js) in die Editor-Seite einhängen,
// ohne die h5p-cli-Installation selbst zu verändern.
const readFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...rest) {
  const data = readFileSync.call(fs, file, ...rest);
  if (typeof data === 'string' && String(file).endsWith('/templates/edit.html')) {
    return data.replace('</head>', '<script type="text/javascript" src="/tools/schnellspeichern.js"></script>\n</head>');
  }
  return data;
};

// Import und Export auf Moodle-Libraries festlegen (tools/moodle-paket.js).
// Der Export von h5p-cli würde Libraries von GitHub master einpacken, die in Moodle plattformweit
// Libraries ersetzen können. Aus demselben Grund sind setup, install und clone hier gesperrt.
const [befehl, erstes, zweites] = process.argv.slice(2);
const exportieren = (ordner) => paket.exportieren(ordner, config.files.patterns.allowed);
if (befehl === 'export') { // h5p export <library> <ordner>
  try {
    console.log(exportieren(zweites));
    process.exit(0);
  }
  catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
if (befehl === 'import') { // h5p import <ordner> <archiv>
  paket.vorImport(erstes, zweites);
}
if (['setup', 'install', 'clone'].includes(befehl) && !process.env.H5P_GITHUB_LIBRARIES) {
  console.error(`"h5p ${befehl}" ist in diesem Ordner gesperrt: Es würde Libraries von GitHub holen statt aus Moodle.\nLibraries kommen hier über den Import einer .h5p aus Moodle.`);
  process.exit(1);
}
if (befehl === 'server') {
  // Erst nach dem Start ersetzen, vorher ist logic.js noch nicht fertig geladen
  setImmediate(() => {
    const logic = require(`${require.main.path}/logic.js`);
    const importieren = logic.import;
    logic.import = (ordner, archiv) => {
      paket.vorImport(ordner, archiv);
      return importieren(ordner, archiv);
    };
    logic.export = async (library, ordner) => exportieren(ordner);
  });
}

module.exports = config;

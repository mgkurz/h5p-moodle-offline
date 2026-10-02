// Import und Export von H5P-Paketen, die zu den Libraries des Moodle-Systems passen.
//
// Import: Das Moodle-Original wird unter originale/<Ordner>.h5p aufbewahrt, fehlende Libraries
// werden daraus nach libraries/ entpackt (Moodle-Versionen statt GitHub master).
// Export: Die Libraries kommen unverändert aus dem Moodle-Original, ersetzt wird nur der Inhalt.
// Vor der Ausgabe wird geprüft, dass das Paket zum Moodle-Original passt.
// Eingehängt über config.js, ersetzt dort den Export von h5p-cli.
const fs = require('fs');
const path = require('path');
const AdmZip = require.main.require('adm-zip');

const ORIGINALE = 'originale';
const LIBRARIES = 'libraries';
const AUSGABE = 'temp';

const istInhalt = (name) => name === 'h5p.json' || name.startsWith('content/');
const maschinenName = (ordner) => ordner.replace(/-\d+\.\d+$/, '');

function vorImport(ordner, archiv) {
  fs.mkdirSync(ORIGINALE, { recursive: true });
  fs.copyFileSync(archiv, `${ORIGINALE}/${ordner}.h5p`);
  const vorhanden = new Map(fs.readdirSync(LIBRARIES).map((name) => [maschinenName(name), name]));
  const zip = new AdmZip(archiv);
  const neu = new Set();
  for (const eintrag of zip.getEntries()) {
    if (eintrag.isDirectory || istInhalt(eintrag.entryName)) {
      continue;
    }
    const lib = eintrag.entryName.split('/')[0];
    if (!neu.has(lib)) {
      const bestehend = vorhanden.get(maschinenName(lib));
      if (bestehend) {
        if (bestehend !== lib) {
          // h5p-cli kann je Library nur eine Version führen
          console.log(`!!! ${lib} nicht installiert, ${bestehend} ist schon vorhanden`);
          vorhanden.set(maschinenName(lib), lib); // nur einmal melden
        }
        continue;
      }
      neu.add(lib);
    }
    zip.extractEntryTo(eintrag, LIBRARIES, true, true);
  }
  console.log(`> Moodle-Original gesichert: ${ORIGINALE}/${ordner}.h5p, ${neu.size} Libraries neu installiert`);
}

function inhaltsDateien(ordner, allowed, relativ = '') {
  const liste = [];
  for (const eintrag of fs.readdirSync(path.join(ordner, relativ), { withFileTypes: true })) {
    const name = eintrag.name;
    const rel = relativ ? `${relativ}/${name}` : name;
    if (name.startsWith('.') || name.endsWith('~')) {
      continue;
    }
    if (eintrag.isDirectory()) {
      if (rel !== 'sessions') {
        liste.push(...inhaltsDateien(ordner, allowed, rel));
      }
      continue;
    }
    // h5p.json liegt im Paket auf oberster Ebene, die *_content.json sind Upgrade-Sicherungen von h5p-cli
    if (rel === 'h5p.json' || /^\d+\.\d+_(content|h5p)\.json$/.test(rel) || !allowed.test(name)) {
      continue;
    }
    liste.push(rel);
  }
  return liste;
}

function exportieren(ordner, allowed) {
  const original = `${ORIGINALE}/${ordner}.h5p`;
  const quelle = `content/${ordner}`;
  if (!fs.existsSync(original)) {
    throw new Error(`Kein Moodle-Original für "${ordner}" (${original} fehlt). Export nur für Inhalte, die als .h5p aus Moodle importiert wurden.`);
  }
  const alt = new AdmZip(original);
  const neu = new AdmZip();
  const libDateien = new Map();
  const libVersionen = new Set();
  for (const eintrag of alt.getEntries()) {
    if (eintrag.isDirectory || istInhalt(eintrag.entryName)) {
      continue;
    }
    const daten = eintrag.getData();
    neu.addFile(eintrag.entryName, daten);
    libDateien.set(eintrag.entryName, eintrag.header.crc);
    if (/^[^/]+\/library\.json$/.test(eintrag.entryName)) {
      const lib = JSON.parse(daten.toString('utf-8'));
      libVersionen.add(`${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`);
    }
  }

  // Prüfung 1: Alles, was der Inhalt verwendet, muss im Moodle-Original als Library enthalten sein
  const info = JSON.parse(fs.readFileSync(`${quelle}/h5p.json`, 'utf-8'));
  const inhalt = fs.readFileSync(`${quelle}/content.json`, 'utf-8');
  const benutzt = new Set(info.preloadedDependencies.map((dep) => `${dep.machineName} ${dep.majorVersion}.${dep.minorVersion}`));
  for (const treffer of inhalt.matchAll(/"library":"([^"]+ \d+\.\d+)"/g)) {
    benutzt.add(treffer[1]);
  }
  const fehlend = [...benutzt].filter((lib) => !libVersionen.has(lib));
  if (fehlend.length) {
    throw new Error(`Export abgebrochen. Der Inhalt verwendet Inhaltstypen, die im Moodle-Original nicht enthalten sind: ${fehlend.join(', ')}`);
  }

  const dateien = inhaltsDateien(quelle, allowed);
  for (const rel of dateien) {
    neu.addFile(`content/${rel}`, fs.readFileSync(`${quelle}/${rel}`));
  }
  neu.addFile('h5p.json', fs.readFileSync(`${quelle}/h5p.json`));

  for (const name of fs.readdirSync(AUSGABE)) {
    if (name.startsWith(`${ordner}-`) && name.endsWith('.h5p')) {
      fs.rmSync(`${AUSGABE}/${name}`); // frühere Exporte dieses Inhalts
    }
  }
  const jetzt = new Date();
  const zwei = (zahl) => String(zahl).padStart(2, '0');
  const stempel = `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}-${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}`;
  const ziel = `${AUSGABE}/${ordner}-${stempel}.h5p`;
  neu.writeZip(ziel);

  // Prüfung 2: Library-Dateien im fertigen Paket müssen nach Pfad und Prüfsumme dem Moodle-Original entsprechen
  const abweichend = [];
  let gezaehlt = 0;
  for (const eintrag of new AdmZip(ziel).getEntries()) {
    if (eintrag.isDirectory || istInhalt(eintrag.entryName)) {
      continue;
    }
    gezaehlt++;
    if (libDateien.get(eintrag.entryName) !== eintrag.header.crc) {
      abweichend.push(eintrag.entryName);
    }
  }
  if (abweichend.length || gezaehlt !== libDateien.size) {
    fs.rmSync(ziel);
    throw new Error(`Export abgebrochen. Libraries weichen vom Moodle-Original ab: ${abweichend.slice(0, 5).join(', ') || 'Anzahl der Dateien stimmt nicht'}`);
  }
  console.log(`> Export ${ziel}: ${libDateien.size} Library-Dateien identisch mit dem Moodle-Original, ${benutzt.size} verwendete Inhaltstypen enthalten, ${dateien.length} Inhaltsdateien`);
  return ziel;
}

module.exports = { vorImport, exportieren };

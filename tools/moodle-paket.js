// Import und Export von H5P-Paketen, die zu den Libraries des Moodle-Systems passen.
//
// Import: Das Moodle-Original wird unter originale/<Ordner>.h5p aufbewahrt, fehlende Libraries
// werden daraus nach libraries/ entpackt (Moodle-Versionen statt GitHub master).
// Export: Die Libraries kommen unverändert aus den Moodle-Originalen in originale/, und zwar genau die,
// die der Inhalt braucht. Vor der Ausgabe wird geprüft, dass das Paket zu den Originalen und,
// wenn moodle-stand.txt vorliegt, zum Library-Stand des Ziel-Moodle passt.
// Eingehängt über config.js, ersetzt dort den Export von h5p-cli.
const fs = require('fs');
const path = require('path');
const AdmZip = require.main.require('adm-zip');

const ORIGINALE = 'originale';
const LIBRARIES = 'libraries';
const AUSGABE = 'temp';
const STAND = 'moodle-stand.txt';

const istInhalt = (name) => name === 'h5p.json' || name.startsWith('content/');
const maschinenName = (ordner) => ordner.replace(/-\d+\.\d+$/, '');
const schluessel = (lib) => `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`;

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

function istInstalliert(ordner, libraryJson) {
  const datei = `${LIBRARIES}/${ordner}library.json`;
  return fs.existsSync(datei) && fs.readFileSync(datei).equals(libraryJson);
}

// Alle Libraries aus den Moodle-Originalen dieses Ordners. Liegt eine Version in mehreren
// Dateien, gilt die mit dem höchsten Patch-Stand. Ein Library-Ordner kommt immer ganz aus einer Datei.
function libraryVorrat() {
  const vorrat = new Map();
  if (!fs.existsSync(ORIGINALE)) {
    return vorrat;
  }
  for (const datei of fs.readdirSync(ORIGINALE).filter((name) => name.endsWith('.h5p')).sort()) {
    const eintraege = new AdmZip(`${ORIGINALE}/${datei}`).getEntries()
      .filter((eintrag) => !eintrag.isDirectory && !istInhalt(eintrag.entryName));
    for (const eintrag of eintraege) {
      if (!/^[^/]+\/library\.json$/.test(eintrag.entryName)) {
        continue;
      }
      const daten = eintrag.getData();
      const info = JSON.parse(daten.toString('utf-8'));
      const bisher = vorrat.get(schluessel(info));
      const ordner = `${eintrag.entryName.split('/')[0]}/`;
      // Gleicher Patch-Stand ist nicht immer bitgleich (Exporte aus mod_hvp tragen z.B. mehr Sprachdateien).
      // Dann gilt die Fassung, die in libraries/ installiert ist und mit der der Editor arbeitet.
      if (bisher && (bisher.info.patchVersion > info.patchVersion
        || (bisher.info.patchVersion === info.patchVersion && !istInstalliert(ordner, daten)))) {
        continue;
      }
      vorrat.set(schluessel(info), { info, dateien: eintraege.filter((e) => e.entryName.startsWith(ordner)) });
    }
  }
  return vorrat;
}

// Folgt den Abhängigkeiten der angegebenen Arten durch den Vorrat
function aufloesen(start, vorrat, arten) {
  const gefunden = new Set();
  const fehlend = new Set();
  const offen = [...start];
  while (offen.length) {
    const lib = offen.pop();
    if (gefunden.has(lib) || fehlend.has(lib)) {
      continue;
    }
    const eintrag = vorrat.get(lib);
    if (!eintrag) {
      fehlend.add(lib);
      continue;
    }
    gefunden.add(lib);
    for (const art of arten) {
      offen.push(...(eintrag.info[art] || []).map(schluessel));
    }
  }
  return { gefunden, fehlend };
}

// Liest moodle-stand.txt: Titel -> Liste der im Ziel-Moodle installierten Versionen. Ohne Datei null.
function moodleStand() {
  if (!fs.existsSync(STAND)) {
    return null;
  }
  const stand = new Map();
  for (const zeile of fs.readFileSync(STAND, 'utf-8').split('\n')) {
    const felder = zeile.split('\t').map((feld) => feld.trim()).filter(Boolean);
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(felder[felder.length - 1] || '');
    if (zeile.trim().startsWith('#') || felder.length < 2 || !version) {
      continue;
    }
    const titel = felder[0];
    stand.set(titel, [...(stand.get(titel) || []), version.slice(1).map(Number)]);
  }
  return stand;
}

// Prüfung 3: Jede Library muss im Ziel-Moodle in dieser Version installiert sein, dort mit gleichem oder höherem Patch-Stand
function gegenMoodleStand(libs, vorrat, stand) {
  const probleme = [];
  let aelter = 0;
  for (const lib of libs) {
    const info = vorrat.get(lib).info;
    const patches = (stand.get(info.title) || [])
      .filter(([major, minor]) => major === info.majorVersion && minor === info.minorVersion)
      .map(([, , patch]) => patch);
    if (!patches.length) {
      probleme.push(`${lib} (${info.title}) ist dort nicht installiert`);
    }
    else if (Math.max(...patches) < info.patchVersion) {
      probleme.push(`${lib}.${info.patchVersion} (${info.title}) ist neuer als dort (${info.majorVersion}.${info.minorVersion}.${Math.max(...patches)})`);
    }
    else if (!patches.includes(info.patchVersion)) {
      aelter++;
    }
  }
  if (probleme.length) {
    throw new Error(`Export abgebrochen. Das Paket passt nicht zum Moodle-Stand in ${STAND}: ${probleme.join(', ')}`);
  }
  const datum = fs.statSync(STAND).mtime.toLocaleDateString('de-DE');
  return `alle im Moodle-Stand vom ${datum} vorhanden${aelter ? `, ${aelter} davon dort mit neuerem Patch-Stand` : ''}`;
}

// Versionen der Inhaltstypen, die sich gegenüber dem eigenen Moodle-Original geändert haben
function hochgestuft(original, benutzt) {
  const zip = new AdmZip(original);
  const info = JSON.parse(zip.readAsText('h5p.json'));
  const vorher = new Map(info.preloadedDependencies.map((dep) => [dep.machineName, `${dep.majorVersion}.${dep.minorVersion}`]));
  const liste = [];
  for (const lib of benutzt) {
    const [name, version] = lib.split(' ');
    if (vorher.has(name) && vorher.get(name) !== version) {
      liste.push(`${name} ${vorher.get(name)} → ${version}`);
    }
  }
  return liste.sort();
}

function exportieren(ordner, allowed) {
  const original = `${ORIGINALE}/${ordner}.h5p`;
  const quelle = `content/${ordner}`;
  const vorrat = libraryVorrat();
  const stand = moodleStand();
  if (!fs.existsSync(original) && !stand) {
    // Ohne eigenes Moodle-Original ist die Liste die einzige Absicherung
    throw new Error(`Export abgebrochen. "${ordner}" wurde nicht aus Moodle importiert, und ${STAND} fehlt. Neu angelegte Inhalte lassen sich nur exportieren, wenn der Moodle-Stand hinterlegt ist.`);
  }

  // Prüfung 1: Alles, was der Inhalt verwendet, muss samt Abhängigkeiten aus einem Moodle-Original kommen
  const info = JSON.parse(fs.readFileSync(`${quelle}/h5p.json`, 'utf-8'));
  const inhalt = fs.readFileSync(`${quelle}/content.json`, 'utf-8');
  const haupt = info.preloadedDependencies.find((dep) => dep.machineName === info.mainLibrary);
  if (!haupt) {
    throw new Error(`Export abgebrochen. ${quelle}/h5p.json nennt keine Version für ${info.mainLibrary}.`);
  }
  const benutzt = new Set([schluessel(haupt)]);
  for (const treffer of inhalt.matchAll(/"library":"([^"]+ \d+\.\d+)"/g)) {
    benutzt.add(treffer[1]);
  }
  const paket = aufloesen(benutzt, vorrat, ['preloadedDependencies', 'dynamicDependencies', 'editorDependencies']);
  if (paket.fehlend.size) {
    throw new Error(`Export abgebrochen. Diese Libraries stecken in keiner der Moodle-Dateien in ${ORIGINALE}/: ${[...paket.fehlend].sort().join(', ')}. Abhilfe: einen Inhalt aus Moodle importieren, der sie enthält.`);
  }
  const standText = stand ? gegenMoodleStand(paket.gefunden, vorrat, stand) : `!!! nicht gegen den Moodle-Stand geprüft, ${STAND} fehlt`;

  const neu = new AdmZip();
  const libDateien = new Map();
  for (const lib of paket.gefunden) {
    for (const eintrag of vorrat.get(lib).dateien) {
      neu.addFile(eintrag.entryName, eintrag.getData());
      libDateien.set(eintrag.entryName, eintrag.header.crc);
    }
  }
  const dateien = inhaltsDateien(quelle, allowed);
  for (const rel of dateien) {
    neu.addFile(`content/${rel}`, fs.readFileSync(`${quelle}/${rel}`));
  }
  // h5p.json: h5p-cli trägt nach einem Upgrade alle installierten Libraries ein, Moodle erwartet nur die geladenen
  const geladen = aufloesen(benutzt, vorrat, ['preloadedDependencies']).gefunden;
  info.preloadedDependencies = [...geladen].sort().map((lib) => {
    const { machineName, majorVersion, minorVersion } = vorrat.get(lib).info;
    return { machineName, majorVersion, minorVersion };
  });
  neu.addFile('h5p.json', Buffer.from(JSON.stringify(info), 'utf-8'));

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
  console.log(`> Export ${ziel}: ${paket.gefunden.size} Libraries (${libDateien.size} Dateien) identisch mit den Moodle-Originalen, ${standText}, ${dateien.length} Inhaltsdateien`);
  const angehoben = fs.existsSync(original) ? hochgestuft(original, benutzt) : [];
  if (angehoben.length) {
    console.log(`> Gegenüber dem Moodle-Original hochgestuft: ${angehoben.join(', ')}`);
  }
  return ziel;
}

module.exports = { vorImport, exportieren };

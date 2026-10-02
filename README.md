# h5p-moodle-offline

H5P-Inhalte aus Moodle am eigenen Rechner bearbeiten und als .h5p-Datei wieder nach Moodle bringen, ohne dass sich dabei die H5P-Libraries im Moodle verändern.

Das Projekt ist eine kleine Ergänzung zu [h5p-cli](https://github.com/h5p/h5p-cli), dem Entwicklerwerkzeug der H5P Group. h5p-cli liefert den lokalen Webserver mit Editor und Vorschau. Dieses Repo fügt drei Dinge hinzu:

- **Import mit Moodle-Libraries.** Beim Import einer .h5p aus Moodle werden die darin enthaltenen Libraries installiert, genau in den Versionen des Moodle-Systems.
- **Geprüfter Export.** Der Export nimmt die Libraries unverändert aus der ursprünglichen Moodle-Datei und tauscht nur den Inhalt aus. Weicht etwas ab, entsteht keine Datei.
- **Schnellspeichern mit Vorschau.** Links die Vorschau, rechts der Editor. Speichern mit Cmd+S (Windows: Strg+S), die Vorschau lädt neu.

## Wozu

Lumi 1.0.3 öffnet Inhalte aus neueren Moodle-Versionen nicht mehr (Fehler `api-version-unsupported`, die Libraries verlangen die H5P-Kern-API 1.28).

h5p-cli allein ist kein sicherer Ersatz: Es holt die Libraries von GitHub, und sein Export packt sie in die .h5p-Datei. Einige davon sind neuer als die im Moodle. Lädt jemand mit dem Recht, Libraries zu aktualisieren, so eine Datei hoch, ersetzt Moodle diese Libraries für die ganze Plattform. Dieses Repo verhindert das.

## Voraussetzungen

- [Node.js](https://nodejs.org/) (aktuelle LTS-Version oder neuer)
- [git](https://git-scm.com/downloads)
- Windows: die Befehle in **Git Bash** eingeben (wird mit git installiert), nicht in der Eingabeaufforderung

## Einrichten

Einmalig, im Terminal (Mac) oder in Git Bash (Windows):

```
npm install -g h5p-cli@1.1.6 --allow-scripts=h5p-cli
git clone https://github.com/mgkurz/h5p-moodle-offline.git
cd h5p-moodle-offline
h5p core
```

Was die Befehle tun:

1. `npm install …` installiert h5p-cli in genau der Version, mit der dieses Repo geprüft ist. Der Zusatz `--allow-scripts` wird von neuen npm-Versionen verlangt, ältere ignorieren ihn.
2. `git clone …` lädt dieses Repo in einen Ordner `h5p-moodle-offline`.
3. `cd …` wechselt in diesen Ordner. Alle weiteren Befehle gelten nur dort.
4. `h5p core` lädt die H5P-Kernbibliotheken. Das dauert einen Moment.

## Arbeiten

Server starten, im Ordner `h5p-moodle-offline`:

```
h5p server
```

Dann im Browser http://localhost:8080 öffnen. Der Server läuft, solange das Terminalfenster offen ist. Beenden mit Strg+C.

1. **In Moodle** den H5P-Inhalt als .h5p-Datei herunterladen.
2. **Importieren:** Im Dashboard auf „Import“ klicken, einen kurzen Namen vergeben (nur Buchstaben, Ziffern, Bindestriche) und die .h5p-Datei wählen.
3. **Bearbeiten:** Inhalt über das Augensymbol öffnen, dann oben auf „Split-View“ klicken. Rechts bearbeiten, mit Cmd+S oder Strg+S speichern. Die Vorschau links zeigt den neuen Stand.
4. **Exportieren:** Rechts oben auf „Export für Moodle“ klicken. Die Datei wird gespeichert und mit Datum im Namen heruntergeladen.
5. **In Moodle** die exportierte Datei hochladen, zuerst in die Inhaltsdatenbank, nicht direkt in einen laufenden Kurs.

## Was der Export prüft

- Jede Library-Datei im Paket stimmt mit der ursprünglichen Moodle-Datei überein (Pfad und Prüfsumme).
- Der Inhalt verwendet nur Inhaltstypen, die in der ursprünglichen Moodle-Datei enthalten sind.

Schlägt eine Prüfung fehl, bricht der Export ab und nennt den Grund. Geprüft wird gegen die Datei, die aus Moodle heruntergeladen wurde, nicht gegen das laufende Moodle.

## Regeln und Grenzen

- **Nur Inhalte bearbeiten, die aus Moodle importiert wurden.** Für neu angelegte Inhalte gibt es keinen Export.
- **Im Editor nur Inhaltstypen verwenden, die der Inhalt schon enthält.** Andere fehlen in der Moodle-Datei, der Export lehnt sie ab.
- **`h5p setup`, `h5p install` und `h5p clone` sind in diesem Ordner gesperrt.** Sie würden Libraries von GitHub holen.
- **Ein Ordner, ein Moodle-Stand.** h5p-cli führt je Library nur eine Version. Inhalte aus verschiedenen Moodle-Systemen gehören in getrennte Ordner.
- **Die ursprünglichen Moodle-Dateien liegen in `originale/`.** Ohne sie ist kein Export möglich, also nicht löschen, solange am Inhalt gearbeitet wird.
- **Internet wird gebraucht:** beim Einrichten und beim ersten Öffnen eines Inhalts, weil h5p-cli dann Beschreibungsdateien von GitHub nachlädt.
- **Nur mit h5p-cli 1.1.6 geprüft.** Die Ergänzungen greifen in Interna von h5p-cli ein. Bei einer anderen Version erscheint beim Start eine Warnung.

## Stand der Erprobung

| Was | Stand |
|---|---|
| Import, Bearbeiten, Schnellspeichern, Export auf macOS | getestet mit einem Interactive Book aus Moodle 4.5 |
| Upload der exportierten Datei nach Moodle | noch nicht getestet |
| Windows | noch nicht getestet |
| Felder mit Textformatierung beim Schnellspeichern | noch nicht getestet |

## Dateien

| Datei | Aufgabe |
|---|---|
| `config.js` | wird von h5p-cli aus dem Arbeitsordner geladen und hängt die Ergänzungen ein |
| `tools/moodle-paket.js` | Import und Export mit den Libraries aus Moodle |
| `tools/schnellspeichern.js` | Speichern und Export direkt aus dem Editor |

Kursinhalte, Moodle-Dateien und Libraries (`content/`, `originale/`, `libraries/`, `temp/`) bleiben lokal und werden nicht ins Repo übernommen.

## Lizenz und Hinweise

MIT, siehe [LICENSE](LICENSE). Autor: Martin Kurz.

Dieses Projekt ist nicht mit der H5P Group oder mit Moodle verbunden. H5P ist eine Marke der H5P Group, Moodle eine Marke von Moodle Pty Ltd. h5p-cli steht unter MIT-Lizenz, die H5P-Kernbibliotheken unter GPL-3.0. Beide werden beim Einrichten geladen und sind nicht Teil dieses Repos.

Nutzung auf eigene Verantwortung: Vor dem Einsatz in einem laufenden Kurs den Upload mit einem Testinhalt prüfen.

# h5p-moodle-offline

H5P-Inhalte aus Moodle am eigenen Rechner bearbeiten und als .h5p-Datei wieder nach Moodle bringen, ohne dass sich dabei die H5P-Libraries im Moodle verändern.

Das Projekt ist eine kleine Ergänzung zu [h5p-cli](https://github.com/h5p/h5p-cli), dem Entwicklerwerkzeug der H5P Group. h5p-cli liefert den lokalen Webserver mit Editor und Vorschau. Dieses Repo fügt drei Dinge hinzu:

- **Import mit Moodle-Libraries.** Beim Import einer .h5p aus Moodle werden die darin enthaltenen Libraries installiert, genau in den Versionen des Moodle-Systems.
- **Geprüfter Export.** Der Export nimmt die Libraries unverändert aus den Moodle-Dateien, die in diesem Ordner importiert wurden, und packt nur die ein, die der Inhalt braucht. Weicht etwas ab, entsteht keine Datei.
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

### Älteren Inhalt aktualisieren

Moodle hält von jedem Inhaltstyp mehrere Versionen nebeneinander. Ein Inhalt bleibt auf seiner Version, bis ihn jemand im Moodle-Editor speichert. h5p-cli kennt je Inhaltstyp nur eine Version und hebt ältere Inhalte beim Öffnen auf diese an, wie der Moodle-Editor.

1. Zuerst einen aktuellen Inhalt desselben Typs aus Moodle importieren, etwa ein frisch angelegtes, leeres Interactive Book. So kommen die neuesten Versionen in den Ordner.
2. Dann den älteren Inhalt importieren und bearbeiten. Der Export nennt die angehobenen Versionen.

Wird der ältere Inhalt zuerst importiert, bleibt der Ordner auf dem alten Stand. Dann den Ordner neu aufsetzen.

### Neuen Inhalt anlegen

Im Dashboard unter „Create“ einen Namen vergeben und den Inhaltstyp wählen. Exportieren geht nur, wenn `moodle-stand.txt` vorliegt (siehe unten) und alle nötigen Libraries aus einer importierten Moodle-Datei stammen. Am einfachsten vorher einen leeren Inhalt desselben Typs aus Moodle importieren.

## Was der Export prüft

- Alles, was der Inhalt verwendet, steckt samt Abhängigkeiten in einer der Moodle-Dateien in `originale/`.
- Jede Library-Datei im Paket stimmt mit ihrer Moodle-Datei überein (Pfad und Prüfsumme).
- Wenn `moodle-stand.txt` vorliegt: Jede Library im Paket ist im Ziel-Moodle in dieser Version installiert, dort mit gleichem oder neuerem Patch-Stand.

Die Abhängigkeitsliste in `h5p.json` schreibt der Export selbst, mit genau den Libraries, die der Inhalt lädt. h5p-cli trägt dort sonst alle installierten ein.

Schlägt eine Prüfung fehl, bricht der Export ab und nennt den Grund.

### Moodle-Stand hinterlegen (`moodle-stand.txt`)

Optional für bearbeitete Inhalte, Pflicht für neu angelegte. Nur mit Admin-Zugang zum Moodle möglich.

1. In Moodle: Website-Administration → H5P → H5P-Inhaltstypen verwalten.
2. Auf beiden Reitern („Installierte H5P-Inhaltstypen“ und „Installierte H5P-Bibliotheken“) die Tabelle markieren, kopieren und untereinander in eine Datei `moodle-stand.txt` in diesem Ordner einfügen.
3. Zeilen mit `#` sind Kommentare, etwa für Instanz und Datum. Nach Library-Updates im Moodle die Datei neu erstellen.

Die Datei bleibt lokal und wird nicht ins Repo übernommen.

## Regeln und Grenzen

- **Neu angelegte Inhalte nur mit `moodle-stand.txt` exportieren.** Ohne eigene Moodle-Datei ist die Liste die einzige Absicherung.
- **Im Editor nur Inhaltstypen verwenden, die in einer importierten Moodle-Datei stecken.** Andere lehnt der Export ab.
- **`h5p setup`, `h5p install` und `h5p clone` sind in diesem Ordner gesperrt.** Sie würden Libraries von GitHub holen.
- **Ein Ordner, ein Moodle-Stand.** Inhalte aus verschiedenen Moodle-Systemen gehören in getrennte Ordner. Das gilt auch innerhalb einer Instanz: Das H5P im Moodle-Kern (Inhaltsspeicher, Aktivität „H5P“) und das Plugin mod_hvp (Aktivität „Interaktiver Inhalt“) haben getrennte Library-Bestände. Eine Datei aus dem Inhaltsspeicher kann noch Libraries aus mod_hvp tragen, wenn sie dort nie im Editor gespeichert wurde. `moodle-stand.txt` deckt solche Mischungen auf.
- **Die ursprünglichen Moodle-Dateien liegen in `originale/`.** Aus ihnen kommen die Libraries für alle Exporte des Ordners, also nicht löschen.
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
| `moodle-stand.txt` | optional, lokal: Library-Stand des Ziel-Moodle für die Prüfung beim Export |
| `tools/schnellspeichern.js` | Speichern und Export direkt aus dem Editor |

Kursinhalte, Moodle-Dateien, Libraries und der Moodle-Stand (`content/`, `originale/`, `libraries/`, `temp/`, `moodle-stand.txt`) bleiben lokal und werden nicht ins Repo übernommen.

## Lizenz und Hinweise

MIT, siehe [LICENSE](LICENSE). Autor: Martin Kurz.

Dieses Projekt ist nicht mit der H5P Group oder mit Moodle verbunden. H5P ist eine Marke der H5P Group, Moodle eine Marke von Moodle Pty Ltd. h5p-cli steht unter MIT-Lizenz, die H5P-Kernbibliotheken unter GPL-3.0. Beide werden beim Einrichten geladen und sind nicht Teil dieses Repos.

Nutzung auf eigene Verantwortung: Vor dem Einsatz in einem laufenden Kurs den Upload mit einem Testinhalt prüfen.

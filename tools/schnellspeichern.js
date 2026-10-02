// Schnellspeichern für den h5p-cli-Editor.
// Speichert per Cmd+S (Windows: Strg+S) oder schwebendem Knopf im Hintergrund, ohne dass der Editor neu lädt.
// In der Split-Ansicht (/split/...) wird danach die Vorschau neu geladen.
// Der Knopf "Export für Moodle" speichert und lädt dann die geprüfte .h5p-Datei herunter.
// Eingebunden über config.js in diesem Ordner, die h5p-cli-Installation bleibt unverändert.
(function () {
  if (!window.H5PEditor || !H5PEditor.Editor) {
    return;
  }

  // Editor-Instanz abgreifen, H5PEditor.init hält sie sonst nur intern
  const Original = H5PEditor.Editor;
  let editor;
  function MitZugriff(...args) {
    editor = new Original(...args);
    const iframe = document.querySelector('.h5p-editor-iframe');
    if (iframe) {
      iframe.addEventListener('load', () => tastenkuerzel(iframe.contentWindow));
    }
    return editor;
  }
  MitZugriff.prototype = Original.prototype;
  Object.assign(MitZugriff, Original);
  H5PEditor.Editor = MitZugriff;

  let anzeige;
  let letztesFeld;
  let speichertGerade = false;

  function status(text, fehler) {
    anzeige.textContent = text;
    anzeige.style.background = fehler ? '#b00020' : '#1f6f43';
  }

  function vorschauNeuLaden() {
    if (window.parent === window) {
      return;
    }
    const vorschau = window.parent.document.getElementById('h5p-cli-view');
    if (vorschau) {
      vorschau.addEventListener('load', fokusZurueck, { once: true });
      vorschau.contentWindow.location.reload();
    }
  }

  function fokusZurueck() {
    if (letztesFeld && letztesFeld.isConnected) {
      letztesFeld.focus();
    }
  }

  // Liefert ein Promise mit true, wenn gespeichert wurde
  function speichern() {
    if (!editor || speichertGerade) {
      return Promise.resolve(false);
    }
    speichertGerade = true;
    status('Speichere …');
    // Der Editor übernimmt ein Feld erst beim Verlassen, deshalb vor dem Auslesen kurz den Fokus nehmen
    const innen = editor.iframeWindow;
    const aktiv = innen && innen.document.activeElement;
    letztesFeld = aktiv && aktiv !== innen.document.body ? aktiv : null;
    if (letztesFeld) {
      letztesFeld.blur();
      setTimeout(fokusZurueck, 0);
    }
    return new Promise((fertig) => editor.getContent(async (inhalt) => {
      let gespeichert = false;
      const daten = new FormData();
      daten.append('title', inhalt.title);
      daten.append('library', inhalt.library);
      daten.append('parameters', inhalt.params);
      daten.append('action', 'create');
      try {
        // Erfolg meldet der Server mit einer Weiterleitung, Fehler mit JSON
        const antwort = await fetch(location.pathname + location.search, { method: 'POST', body: daten, redirect: 'manual' });
        if (antwort.type !== 'opaqueredirect') {
          const fehler = await antwort.json().catch(() => ({ error: 'HTTP ' + antwort.status }));
          throw new Error(fehler.error);
        }
        // Der Server markiert den Vorschau-Stand als ungültig, die Vorschau fragt dann bei jedem Laden nach.
        // Stand deshalb ganz löschen, die Vorschau startet ohne Rückfrage neu.
        await fetch('/content-user-data/' + location.pathname.split('/')[3], { method: 'DELETE' });
        status('Gespeichert ' + new Date().toLocaleTimeString('de-DE'));
        vorschauNeuLaden();
        gespeichert = true;
      }
      catch (e) {
        status('Nicht gespeichert: ' + e.message, true);
      }
      editor.formSubmitted = false; // sonst merkt sich der Editor seinen Stand bei einem Neuladen nicht mehr
      speichertGerade = false;
      fertig(gespeichert);
    }, (fehler) => {
      status('Nicht gespeichert: ' + fehler, true);
      speichertGerade = false;
      fertig(false);
    }));
  }

  async function exportieren() {
    if (!await speichern()) {
      return;
    }
    status('Exportiere …');
    try {
      const [, , library, ordner] = location.pathname.split('/'); // /edit/<library>/<ordner>
      const antwort = await fetch(`/export/${library}/${ordner}`);
      // Fehler meldet der Server als JSON, sonst kommt die Datei
      if ((antwort.headers.get('Content-Type') || '').includes('json')) {
        throw new Error((await antwort.json()).error.replace(/^Error: /, ''));
      }
      const name = /filename="([^"]+)"/.exec(antwort.headers.get('Content-Disposition') || '')?.[1] || `${ordner}.h5p`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await antwort.blob());
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
      status('Exportiert: ' + name);
    }
    catch (e) {
      status(e.message, true);
    }
  }

  function tastenkuerzel(ziel) {
    ziel.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        speichern();
      }
    }, true);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const leiste = document.createElement('div');
    leiste.style.cssText = 'position:fixed;top:8px;right:8px;z-index:10000;display:flex;gap:8px;align-items:center;font:14px system-ui,sans-serif';
    anzeige = document.createElement('span');
    anzeige.style.cssText = 'color:#fff;padding:6px 10px;border-radius:4px;background:#1f6f43;max-width:55vw';
    anzeige.textContent = (/Mac/.test(navigator.platform) ? 'Cmd' : 'Strg') + '+S speichert';
    const knopf = (text, aktion) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = text;
      element.style.cssText = 'padding:6px 14px;border:0;border-radius:4px;background:#1a5dab;color:#fff;font:inherit;cursor:pointer;white-space:nowrap';
      element.addEventListener('click', aktion);
      return element;
    };
    leiste.append(anzeige, knopf('Speichern', speichern), knopf('Export für Moodle', exportieren));
    document.body.append(leiste);
  });
  tastenkuerzel(window);
})();

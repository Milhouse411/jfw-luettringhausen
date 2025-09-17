# Dienstbuch Feuerwehr Lüttringhausen

Statische, offlinefähige Web-App zum Führen des Dienstbuchs (Kinder & Betreuer), Anwesenheit und PDF-Export.

## Features
- Mitgliederverwaltung (Kinder: Vor-/Nachname, Geburtsdatum, Eintritt/Austritt, Jugendflamme 1–3, Leistungsspange)
- Automatisches Alter und Probezeit (6 Monate ab Eintritt, wird markiert)
- Betreuerverwaltung (Vor-/Nachname, Führerschein Klasse C, JGL, letzte EH- und Jugendbetreuerschulung; fällig/überfällig-Markierung nach 24 Monaten)
- Dienste anlegen, Anwesenheit (Anwesend/Entschuldigt/Abwesend) je Kind, Betreuer anwesend (mind. 1 erforderlich)
- Statistik (Ø anwesende Kinder/Betreuer, Min/Max, Auswertung je Kind)
- Backup/Restore (JSON), PDF-Export (druckfreundliche Ansicht → „Als PDF sichern“)

## Deployment (GitHub Pages)
1. Lade alle Dateien in ein öffentliches Repository (z. B. `jfw-dienstbuch`).
2. Aktiviere unter **Settings → Pages** die Branch `main` und das Verzeichnis `/ (root)`.
3. Öffne die veröffentlichte URL und füge die App auf iOS/Android zum Home-Bildschirm hinzu.

## Hinweis zu PDF
Der Button „PDF export“ öffnet eine druckfreundliche Seite; mit „Drucken → Als PDF sichern“ kannst du die Datei speichern.

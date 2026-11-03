# Carnet de course

Tableau de bord statique (HTML/CSS/JS, Chart.js embarqué) de la reprise de la course à pied depuis le 24/08/2026.
Aucune clé API, aucun secret : les données sont un instantané dans `data.js` / `data.json`.

## Publier sur GitHub Pages
1. Créer un dépôt (ex. `carnet-de-course`), y déposer tout le contenu de ce dossier à la racine.
2. Settings → Pages → Source : *Deploy from a branch* → `main` / `/ (root)`.
3. Le site est en ligne sous `https://<utilisateur>.github.io/<depot>/`.

## Mettre à jour
Redemander l'export à Claude : il remplace `data.js` (et `data.json`). Rien d'autre à toucher.

# grist-widgets

Widgets personnalisés pour [Grist](https://www.getgrist.com/), maintenus par l'équipe Pilotage de la DITP.

## carte-departements

Carte choroplèthe des départements français, outre-mer compris (Guadeloupe, Martinique, Guyane,
La Réunion et Mayotte sont rapprochées de la métropole, avec un zoom sur Paris et la petite couronne).

## carte-regions

Même carte au niveau des 18 régions.

## Utilisation dans Grist

Ajouter un widget **Custom URL** pointant vers `carte-departements/index.html` ou
`carte-regions/index.html` (servis par GitHub Pages), avec l'accès **lecture de la table**, puis
associer les colonnes :

| Colonne du widget | Obligatoire | Contenu |
|---|---|---|
| Code | oui | Code INSEE du département (`01`, `2A`, `971`…) ou de la région (`84` ou `R84`). Un code à un chiffre est complété (`1` → `01`). |
| Valeur | non | Valeur numérique affichée dans l'info-bulle. Sans couleur associée, la carte est coloriée en dégradé selon cette valeur. |
| Couleur | non | Couleur de remplissage `#RRGGBB`, calculée dans Grist (par exemple selon des seuils). |
| Libellé de légende | non | Libellé de la classe affiché dans la légende (par exemple « Moins de 5 % »). Les classes sont rangées par valeur croissante. |
| Nom affiché | non | Nom de la zone dans l'info-bulle (à défaut, celui du fond de carte). |

Paramètre d'URL facultatif `?format=pct`, `?format=eur` ou `?format=int` pour formater la valeur
(pourcentage, euros, entier).

Seules les zones présentes dans la table sont dessinées ; une zone présente sans valeur ni couleur
apparaît en gris « Données manquantes ». Les filtres du widget Grist s'appliquent (par exemple pour
n'afficher qu'une semaine). Un clic sur une zone sélectionne la ligne correspondante dans Grist.

Les deux widgets partagent `shared/` : le code de la carte (`carte.js`, `carte.css`), la police
Marianne extraite du [DSFR](https://github.com/GouvernementFR/dsfr) (`shared/dsfr/`) et les fonds de
carte GeoJSON (`shared/geo/`, repris de [ces gists](https://gist.github.com/rthoyer)). Le rendu utilise
[D3](https://d3js.org/).

## Déploiement (GitHub Pages)

Le déploiement passe par une GitHub Action (`.github/workflows/deploy-pages.yml`) déclenchée à chaque
push sur `main` : elle inscrit dans le pied de chaque widget la version courte du commit déployé
(`git rev-parse --short HEAD`), puis publie le repo tel quel sur GitHub Pages.

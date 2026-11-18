// Carte choroplèthe commune aux widgets « carte-departements » et « carte-regions ».
//
// Colonnes à associer dans Grist :
//   Code    (obligatoire) code INSEE du département (01, 2A, 971…) ou de la région (84, R84…)
//   Valeur  (facultatif)  valeur numérique, affichée dans l'info-bulle ; colore la carte en dégradé
//                         si aucune couleur n'est associée
//   Couleur (facultatif)  couleur de remplissage (#RRGGBB), calculée dans Grist
//   Legende (facultatif)  libellé de la classe affiché dans la légende (ex. « Moins de 5 % »)
//   Nom     (facultatif)  nom affiché dans l'info-bulle (à défaut, celui du fond de carte)
//
// Paramètre d'URL facultatif : ?format=pct | eur | int (format de la valeur dans l'info-bulle et la légende).
// Les zones du fond de carte absentes de la table ne sont pas dessinées ; celles présentes sans valeur
// ni couleur apparaissent en gris « Données manquantes ».

const COULEUR_MANQUANT = "#D9D9D9";
const LIBELLE_MANQUANT = "Données manquantes";

function normaliserCode(code, niveau) {
  if (code === null || code === undefined) return null;
  let c = String(code).trim().toUpperCase();
  if (!c) return null;
  if (niveau === "region") c = c.replace(/^R/, "");
  if (/^\d$/.test(c)) c = "0" + c;
  return c;
}

function formateur(format) {
  const nf = (opts) => new Intl.NumberFormat("fr-FR", opts);
  if (format === "pct") return (v) => nf({ style: "percent", maximumFractionDigits: 1 }).format(v);
  if (format === "eur") return (v) => nf({ style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (format === "int") return (v) => nf({ maximumFractionDigits: 0 }).format(v);
  return (v) => nf({ maximumFractionDigits: 2 }).format(v);
}

function echapper(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function estNombre(v) {
  return typeof v === "number" && Number.isFinite(v);
}

async function initCarte({ geojson, niveau }) {
  const format = new URLSearchParams(location.search).get("format");
  const fmt = formateur(format);
  const svg = d3.select("#carte");
  const legende = d3.select("#legende");
  const bulle = d3.select("#bulle");
  const message = d3.select("#message");

  const geo = await d3.json(geojson);
  geo.features = geo.features.filter((f) => f.properties && f.properties.code);
  geo.features.forEach((f) => { f.properties.code = normaliserCode(f.properties.code, niveau); });

  let lignes = [];
  let aCouleur = false;

  function couleurDe(ligne, echelle) {
    if (!ligne) return COULEUR_MANQUANT;
    if (aCouleur) return ligne.Couleur || COULEUR_MANQUANT;
    return estNombre(ligne.Valeur) ? echelle(ligne.Valeur) : COULEUR_MANQUANT;
  }

  function dessiner() {
    const parCode = new Map();
    lignes.forEach((l) => { const c = normaliserCode(l.Code, niveau); if (c) parCode.set(c, l); });
    const zones = geo.features.filter((f) => parCode.has(f.properties.code));

    svg.selectAll("*").remove();
    legende.html("");
    if (!zones.length) {
      message.text(lignes.length ? "Aucun code de la table ne correspond au fond de carte." : "Associez la colonne « Code » dans le panneau de configuration du widget.");
      return;
    }
    message.text("");

    const { width, height } = svg.node().getBoundingClientRect();
    const projection = d3.geoMercator().fitExtent([[8, 8], [width - 8, height - 8]], { type: "FeatureCollection", features: zones });
    const chemin = d3.geoPath(projection);

    const valeurs = lignes.map((l) => l.Valeur).filter(estNombre);
    const max = valeurs.length ? Math.max(...valeurs) : 1;
    const min = valeurs.length ? Math.min(0, ...valeurs) : 0;
    // On démarre le dégradé à 15 % pour que les plus petites valeurs restent visibles sur fond blanc.
    const echelle = d3.scaleSequential((t) => d3.interpolateBlues(0.15 + 0.85 * t)).domain([min, max || 1]);

    svg.append("g").selectAll("path").data(zones).join("path")
      .attr("d", chemin)
      .attr("fill", (f) => couleurDe(parCode.get(f.properties.code), echelle))
      .attr("class", "zone")
      .on("mousemove", (event, f) => {
        const l = parCode.get(f.properties.code);
        const nom = (l && l.Nom) || f.properties.nom;
        let html = `<strong>${echapper(nom)}</strong>`;
        if (l && l.Legende) html += `<br>${echapper(l.Legende)}`;
        html += `<br>${estNombre(l && l.Valeur) ? echapper(fmt(l.Valeur)) : LIBELLE_MANQUANT}`;
        bulle.html(html).style("display", "block").style("left", `${event.offsetX + 14}px`).style("top", `${event.offsetY + 10}px`);
      })
      .on("mouseleave", () => bulle.style("display", "none"))
      .on("click", (event, f) => {
        const l = parCode.get(f.properties.code);
        if (l) grist.setCursorPos({ rowId: l.id });
      });

    dessinerLegende(echelle, min, max);
  }

  function dessinerLegende(echelle, min, max) {
    if (aCouleur) {
      // Une entrée par couleur, ordonnée par valeur croissante ; « Données manquantes » en premier.
      const classes = new Map();
      lignes.forEach((l) => {
        const couleur = l.Couleur || COULEUR_MANQUANT;
        const libelle = l.Legende || (l.Couleur ? l.Couleur : LIBELLE_MANQUANT);
        const cle = `${couleur}|${libelle}`;
        const v = estNombre(l.Valeur) ? l.Valeur : -Infinity;
        const c = classes.get(cle);
        if (!c) classes.set(cle, { couleur, libelle, ordre: v });
        else c.ordre = Math.min(c.ordre, v);
      });
      [...classes.values()].sort((a, b) => a.ordre - b.ordre).forEach((c) => {
        legende.append("div").attr("class", "entree")
          .html(`<span class="pastille" style="background:${echapper(c.couleur)}"></span>${echapper(c.libelle)}`);
      });
      return;
    }
    if (!lignes.some((l) => estNombre(l.Valeur))) return;
    const pas = d3.range(0, 1.0001, 0.1).map((t) => echelle(min + t * (max - min)));
    legende.append("div").attr("class", "degrade").style("background", `linear-gradient(to right, ${pas.join(",")})`);
    legende.append("div").attr("class", "bornes").html(`<span>${echapper(fmt(min))}</span><span>${echapper(fmt(max))}</span>`);
    if (lignes.some((l) => !estNombre(l.Valeur))) {
      legende.append("div").attr("class", "entree").html(`<span class="pastille" style="background:${COULEUR_MANQUANT}"></span>${LIBELLE_MANQUANT}`);
    }
  }

  grist.ready({
    requiredAccess: "read table",
    columns: [
      { name: "Code", title: niveau === "region" ? "Code région" : "Code département", type: "Any" },
      { name: "Valeur", title: "Valeur", type: "Numeric", optional: true },
      { name: "Couleur", title: "Couleur (#RRGGBB)", type: "Text", optional: true },
      { name: "Legende", title: "Libellé de légende", type: "Any", optional: true },
      { name: "Nom", title: "Nom affiché", type: "Any", optional: true },
    ],
  });
  grist.onRecords((records, mappings) => {
    aCouleur = Boolean(mappings && mappings.Couleur);
    lignes = grist.mapColumnNames(records) || [];
    dessiner();
  });
  window.addEventListener("resize", () => dessiner());
}

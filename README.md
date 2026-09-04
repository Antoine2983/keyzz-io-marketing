# keyzz-io-marketing

Site marketing de [Keyzz.io](https://keyzz.io), codé au pixel près d'après la maquette
`KEYZZ TEST.pen` (pen.dev).

KEYZz est la couche d'activation post-expérience de RecallBy : transformer chaque scan,
chaque entrée, chaque achat d'un événement en relation client identifiée et activable.

## Contenu

- `index.html` — home, d'après la frame `B2B — Site vitrine V2 (démo)` (`AOXrP`).
- `pricing.html` — page tarifs, d'après la frame `B2B — Page Tarifs` (`ASriL`).
- `assets/site.css`, `assets/site.js` — feuille de style de base et mise à l'échelle du canvas.
- `assets/glass.js` — rejoue le shader animé du film de verre des cartes (voir plus bas).
- `assets/motion.css`, `assets/motion.js` — couche d'animation du site (voir « Animations »).
- `assets/*.webp`, `assets/*.png` — visuels extraits de la maquette.
- `design-export/` — exports `html-css` bruts de pen.dev, sources du build. `bandeau-logos.html`
  est l'export du bandeau de logos redessiné, greffé sur les deux pages par le build.
- `tools/build.py` — régénère les deux pages à partir de ces exports.
- `wireframe-v1.html` — ancienne page unique (wireframe haute-fidélité), conservée pour référence.

Aucune dépendance, aucun framework : les styles viennent de la maquette et sont
appliqués en ligne, comme dans l'export. Les seules ressources externes sont les
polices Google (Space Grotesk, Urbanist, JetBrains Mono) et les photos Unsplash
utilisées comme visuels de démonstration.

## Mise à l'échelle

La maquette est dessinée sur un canvas fixe de 1440 px. Au-dessus de 1440 px, la page
est centrée et rendue à l'échelle 1:1. En dessous, `assets/site.js` réduit
proportionnellement l'ensemble du canvas, de sorte que la mise en page ne casse jamais
et qu'il n'y a jamais de défilement horizontal. Une véritable adaptation mobile
(recomposition des sections) reste à concevoir dans la maquette.

## Film de verre animé

Les nœuds « Film de verre » des cartes KEYZz portent, dans la maquette, un fill
shader `keyzz-glass.glsl` (balayage de reflet et prisme, `u_speed` 0.18). L'export
HTML de pen.dev ne sait pas transporter un shader WebGL : il en fige une image
WebP, ce qui donne l'effet sans le mouvement.

`assets/glass.js` rejoue ce shader sur un canvas WebGL, aux mêmes uniforms
(`intensité 0.55`, `vitesse 0.18`, `biseau 10 px`, `teinte #6E3BFF`), déclarés en
`data-glass-*` sur chaque nœud. Il ne dessine que les termes additifs du shader —
le balayage, le prisme, le biseau et le liseré, c'est-à-dire tout le mouvement —
et les compose en `plus-lighter` par-dessus les couches visuel / scrim / prisme
restées en DOM, que le shader lisait comme `@backdrop`. Deux termes statiques et
discrets du shader d'origine sont donc absents : la réfraction de bord (≤ 3 px) et
le vignettage des coins (6 %).

Le rendu est limité aux cartes visibles à l'écran, respecte
`prefers-reduced-motion` (une image fixe, aucune animation), et retombe sur
l'image figée de l'export si WebGL est indisponible ou si le contexte est perdu.

Si les uniforms changent dans la maquette, mettre à jour `GLASS_ATTRS` dans
`tools/build.py`.

## Animations

Toute la couche de mouvement est isolée dans `assets/motion.css` (hovers, animations
d'ambiance, voile de transition) et `assets/motion.js` (tout ce qui dépend du scroll,
du temps ou du pointeur). Les pages exportées restent intactes : le script repère les
éléments par leur `data-name` et écrit ses états en ligne, puis s'efface pour laisser
les transitions CSS de survol reprendre la main.

- **Transitions de page** — un rideau se ferme au clic sur un lien interne (la page
  s'estompe derrière), puis se lève à l'arrivée. Un lien vers la page courante remonte
  en douceur en haut de page.
- **Intro** — nav en cascade, titre du hero révélé mot à mot par masque, sous-titre,
  boutons et micro-preuve décalés ; sur la page Tarifs, l'en-tête puis le bandeau de
  logos.
- **Reveals au scroll** — chaque section apparaît par groupes échelonnés (en-têtes
  avec titres mot à mot, gains et filets, étapes, mosaïque, témoignages, chiffres,
  plans, FAQ, pied de page).
- **Pièces maîtresses** — l'éventail de KEYZz se distribue depuis la carte du dessus
  puis flotte et s'incline sous le pointeur ; la pile éclatée se déploie couche par
  couche puis réagit au pointeur et au scroll en profondeur ; le dashboard bascule en
  3D à l'arrivée, ses barres se remplissent et son contenu défile avec la page.
- **Compteurs** — les chiffres (gains, bande violette, statistiques, montants) montent
  jusqu'à leur valeur en respectant le format français.
- **Hovers** — boutons aimantés avec balayage lumineux, cartes qui se soulèvent avec
  zoom photo, liens soulignés, onglets, bulles, logos, réseaux sociaux.
- **Ambiance** — halos qui respirent, halo pulsé sur le plan Pro, reflets sur les
  badges, projecteur violet suivant le curseur (invisible sur les sections claires),
  filet de progression en haut de page.

`prefers-reduced-motion` désactive tout mouvement autonome (les états de survol
restent). Si le JavaScript échoue, la page se rend quand même : le stage est révélé
après 2,5 s par une animation CSS de secours, et toute erreur du moteur remet les
éléments masqués à leur état d'origine.

## Régénérer après une modification du design

Dans pen.dev, exporter les deux frames :

```
Export(["AOXrP"], "html-css", "design-export/css-home.html")
Export(["ASriL"], "html-css", "design-export/css-tarifs.html")
```

puis :

```bash
python3 tools/build.py
```

Le script extrait les images encodées en base64 vers `assets/`, remet les sections
bordées en `border-box` (l'export les sort en `content-box`, ce qui empile leur
padding et les élargit à 1560 px), et recrée les liens de navigation entre les pages.

## Prévisualiser

```bash
python3 -m http.server 4321
```

## Déploiement

Hébergé sur GitHub Pages : https://antoine2983.github.io/keyzz-io-marketing/

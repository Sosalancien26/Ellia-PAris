# HANDOFF — Vidéos & photos Higgsfield pour ellia-paris.fr

> Brief à donner tel quel à Claude Cowork. Objectif : générer toutes les vidéos en boucle et les nouvelles photos du site, à partir des photos existantes, sans jamais toucher au site en production avant validation de Sacha.

---

## 0. Ce que tu dois savoir en 30 secondes

- **Marque** : ELLIA PARIS, maroquinerie parisienne. Un seul produit : la Pochette ELLIA, 159 €.
- **Site actuel** : ivoire `#f3f1ec`, Cormorant Garamond + Jost, très aéré. On l'aime tel qu'il est. On ne redessine rien : on remplace des photos fixes par des boucles vidéo de 4 à 8 s et on ajoute des photos.
- **Maquette de référence** (ce qu'on vise) : `Ellia Paris — Propositions v3.dc.html` dans ce projet. Le storyboard en bas de page est repris ci-dessous en version complète.
- **Fichiers du site** : `uploads/Ellia-Paris/` (copie de la prod). **Lecture seule.** Tout ce que tu produis va dans `output/` (voir §6).
- **Outil** : Higgsfield (crédits disponibles). Image-to-video pour les vidéos, génération d'image pour les nouvelles photos.

---

## 1. RÈGLE N°1 — Le logo doit être visible sur CHAQUE visuel

Référence : `uploads/pasted-1790810080779-0.png` (gros plan) et `uploads/Ellia-Paris/assets/pochette-hero.jpg`.

Le produit se reconnaît à **une seule pièce** : la tirette de la fermeture éclair.

- Plaque rectangulaire verticale en **acier brossé argenté**, angles légèrement arrondis, environ 1,5 × 4 cm, suspendue au curseur gunmetal.
- **En haut de la plaque : le picto ELLIA gravé** — un monogramme en spirale circulaire, style empreinte digitale stylisée, gravé en creux, ton sur ton (pas de couleur). Fichiers : `uploads/Ellia-Paris/assets/picto_black_trim.png` / `picto_white_trim.png` / `symbol-ellia.png`.
- Sous le picto : une **petite fente sombre** horizontale, puis le **capteur d'empreinte** (petit rectangle noir mat, coins arrondis).
- Cuir : **noir grainé** à gros grain (grain profond, mat, aucune brillance vernie). Zip : gunmetal.

**Obligations**
1. Sur chaque photo et chaque vidéo, la tirette avec le picto est **visible et lisible** (pas de dos de plaque, pas cachée par une main).
2. Le picto est **exactement** la spirale ELLIA. Si Higgsfield invente un autre motif ou du texte : la génération est refusée.
3. Si l'IA n'arrive pas à reproduire la spirale fidèlement, on **incruste le vrai picto en post-production** (Photoshop/After Effects : `picto_white_trim.png` en mode Multiply à 60–70 % + léger relief intérieur, suivi de mouvement si vidéo). C'est la méthode par défaut pour les gros plans.
4. Mots à inclure dans TOUS les prompts produit :
   `black pebbled grained leather pouch, gunmetal zipper, brushed silver rectangular zipper-pull plate with a small engraved circular spiral monogram at the top and a tiny dark fingerprint sensor below it`
5. Jamais d'autre logo, jamais de texte, jamais d'or sur le site (l'or est réservé aux initiales gravées).

---

## 2. Réglages Higgsfield (communs à toutes les vidéos)

- Mode **Image-to-video**, image source = la photo du site indiquée pour chaque plan (pleine résolution, `.jpg` de préférence au `.webp`).
- Caméra : **Static / locked-off**. Aucun preset de mouvement (pas de dolly, orbit, zoom, handheld, « cinematic »).
- Intensité de mouvement : **basse, 2–3/10**.
- Durée : 5 s (ou le max fixe disponible), ratio indiqué par plan.
- Générer **3 variantes** par plan, garder la **plus lente et la plus stable**. Refuser toute variante où la pochette, le verre, la plaque ou une main se déforme.
- Upscale 1080p ; **4K pour le plan 01** (hero).
- Pas de grain dans le prompt : le grain 35 mm (3 %) s'ajoute au montage.

**Negative prompt commun** (à coller à chaque fois) :
`camera movement, zoom, pan, dolly, orbit, handheld, morphing, warping, deforming product, moving pouch, melting metal, changed logo, text, watermark, extra fingers, extra people, fast motion, flicker, oversaturation, blue sci-fi glow`

---

## 3. STORYBOARD VIDÉO — 8 plans

Format de chaque plan : source → livrable → ce qui bouge / ce qui ne bouge pas → prompt.

### Plan 01 — Hero « L'heure dorée » (le plus important du site)
- **Source** : `assets/hero-sunset.jpg`
- **Livrable** : `hero-sunset.mp4` + `.webm`, 16:9, 8 s en boucle (5 s générées → ping-pong), 4K downscalé en 1920×1080, ≤ 2,5 Mo.
- **Bouge** : surface de la mer (scintillement), buée sur le verre de rosé, 2–3 pétales de bougainvillier qui frémissent par petites rafales, lumière du soleil qui « respire » très légèrement.
- **Ne bouge pas** : la pochette, la plaque et son picto, le verre, la nappe, le cadre.
- **Prompt** :
  `Locked-off static camera, no camera motion. A black pebbled grained leather pouch with a gunmetal zipper and a brushed silver rectangular zipper-pull plate with a small engraved circular spiral monogram at the top and a tiny dark fingerprint sensor below it sits perfectly still on a white linen table; the pouch, the glass and the tablecloth remain completely motionless. Behind it the Mediterranean sea shimmers gently at golden hour, the low sun's glow breathes almost imperceptibly, fine condensation glistens on the glass of rosé, a few magenta bougainvillea petals tremble in short, irregular gusts of warm breeze and one petal shifts a centimetre. Luxury fashion film, photoreal, extremely slow and calm, seamless loop.`

### Plan 02 — Hero mobile (vertical)
- **Source** : `assets/hero-sunset-mobile.webp` (ou recadrage 9:16 de `hero-sunset.jpg` centré sur la pochette).
- **Livrable** : `hero-sunset-mobile.mp4` + `.webm`, 9:16, 1080×1920, 8 s, ≤ 1,8 Mo.
- **Prompt** : identique au plan 01, préfixé de `Vertical 9:16 portrait framing.` Amplitude de mouvement réduite (2/10).

### Plan 03 — Signature « La lumière traverse l'écrin »
- **Source** : `assets/lookbook/pochette-ecrin.webp`
- **Livrable** : `signature-ecrin.mp4` + `.webm`, 4:5, 6 s ping-pong, ≤ 900 Ko.
- **Bouge** : une seule lumière de studio qui balaie de gauche à droite, reflet net qui passe sur la plaque argentée.
- **Ne bouge pas** : pochette, écrin, ombres portées (elles glissent avec la lumière, sans tourner).
- **Prompt** :
  `Locked-off studio shot, static camera. A black pebbled grained leather pouch resting in its matte black gift box, its brushed silver zipper-pull plate with the engraved circular spiral monogram facing the camera, everything perfectly motionless. A single soft studio light sweeps slowly from left to right across the frame, revealing the depth of the leather grain and a brief clean highlight travelling across the silver plate. Minimal, high-end fashion campaign, very slow, photoreal, seamless loop.`

### Plan 04 — Le Film 01 « L'ouverture »
- **Source** : `assets/product-1.jpg` recadré macro sur le zip, ou nouvelle photo macro (voir §4, photo N1).
- **Livrable** : `film-01-ouverture.mp4` + `.webm`, 21:9, 4 s, ≤ 700 Ko.
- **Bouge** : le curseur du zip glisse de 2 cm, au ralenti extrême, les dents accrochent la lumière une à une. La plaque suit le curseur, rigide, sans se tordre.
- **Prompt** :
  `Extreme close-up macro, static camera. A gunmetal zipper on black pebbled grained leather; the zipper slider with its brushed silver rectangular pull plate — small engraved circular spiral monogram at the top, tiny dark fingerprint sensor below — slides open by two centimetres in ultra slow motion, the metal teeth catching a single raking light one by one. The plate stays rigid and legible. Very shallow depth of field, black background, tactile, luxury product film, photoreal, no camera movement.`

### Plan 05 — Le Film 02 « L'empreinte » (plan clé de la marque)
- **Source** : `assets/pochette-fingerprint.jpg`
- **Livrable** : `film-02-empreinte.mp4` + `.webm`, 21:9 + version 4:5 pour la section Biométrie, 5 s, ≤ 800 Ko.
- **Bouge** : le doigt se pose sur le capteur, une lueur **chaude et discrète** confirme, le curseur se libère de 3 mm.
- **Ne bouge pas** : la pochette, la plaque, le picto ; le décor en bokeh reste.
- **Prompt** :
  `Close-up, static camera. A fingertip gently settles on the tiny dark fingerprint sensor at the bottom of a brushed silver rectangular zipper-pull plate on a black pebbled grained leather pouch; the small engraved circular spiral monogram at the top of the plate stays fully visible. A faint warm glow acknowledges the touch and the zipper pull releases by a few millimetres. Warm natural light, soft bokeh background, calm and unhurried, photoreal, no camera movement, seamless loop.`

### Plan 06 — Le Film 03 / Campagne « La Riviera »
- **Source** : `assets/lookbook/campagne-riviera.webp`
- **Livrable** : `campagne-riviera.mp4` + `.webm`, 21:9, 8 s, ≤ 1,2 Mo. Sera désaturé en CSS comme aujourd'hui : livrer en couleur.
- **Bouge** : cheveux, ourlet de la robe, scintillement de la mer, une voile très loin.
- **Ne bouge pas** : la pose, la pochette (plaque visible), le cadre.
- **Prompt** :
  `Static wide shot, editorial fashion film. An elegant woman holding a black pebbled grained leather pouch — its brushed silver zipper-pull plate with the engraved circular spiral monogram turned toward the camera — stands still on the Riviera; a light sea breeze lifts her hair and the hem of her dress, sunlight sparkles on the water behind her, a sail drifts slowly on the horizon. The pouch and her pose remain steady. Timeless, restrained, photoreal, no camera movement, seamless loop.`

### Plan 07 & 08 — Lookbook « Portraits vivants »
- **Sources** : `assets/lookbook/lookbook-port.webp`, `assets/lookbook/lookbook-palais.webp`
- **Livrables** : `lookbook-port.mp4`, `lookbook-palais.mp4` (+ `.webm`), 2:3, 5 s, ≤ 700 Ko chacun. Livrer en couleur (le N&B et le retour de la couleur au survol se font en CSS).
- **Bouge** : un battement de cils, un souffle, le regard qui vient lentement vers l'objectif, cheveux dans une brise.
- **Ne bouge pas** : corps, tête, bouche (pas de sourire), pochette.
- **Prompt** :
  `Living portrait, static camera. The model holds the pose almost perfectly still while holding a black pebbled grained leather pouch with its brushed silver spiral-monogram zipper-pull plate visible: one slow blink, a barely perceptible breath, the eyes drifting slowly toward the lens, hair moving faintly in a breeze. The background light shifts very subtly. Editorial fashion film, restrained, elegant, photoreal, no camera movement, seamless loop.`

---

## 4. NOUVELLES PHOTOS (génération d'image Higgsfield)

Toutes en couleur, ratio indiqué, 3000 px minimum sur le grand côté. Même règle : **plaque et picto visibles et exacts**, sinon incrustation du picto en post. Mots communs à coller dans chaque prompt : voir §1 point 4.

| Réf | Usage sur le site | Ratio | Prompt |
|---|---|---|---|
| N1 | Source du plan 04 + galerie fiche produit | 3:2 | `Macro product photograph, a gunmetal zipper on black pebbled grained leather, the brushed silver rectangular zipper-pull plate with a small engraved circular spiral monogram at the top and a tiny dark fingerprint sensor below, single raking studio light, black background, extreme detail on grain and metal, luxury leather goods campaign.` |
| N2 | Fiche produit — vue de face | 1:1 | `Studio product photograph on warm ivory seamless background (#f3f1ec), black pebbled grained leather zip pouch standing upright, gunmetal zipper closed, brushed silver zipper-pull plate with engraved circular spiral monogram hanging centred and facing camera, soft top light, deep soft shadow, no props, luxury e-commerce.` |
| N3 | Fiche produit — intérieur | 3:2 | `Studio photograph, black pebbled grained leather pouch half open showing the black lining, the brushed silver spiral-monogram zipper-pull plate resting on the leather, ivory background, soft directional light, luxury e-commerce.` |
| N4 | Page Maison — savoir-faire | 3:2 | `Editorial photograph in a Parisian leather workshop, artisan's hands stitching black pebbled grained leather, the finished pouch with its brushed silver spiral-monogram plate resting in the foreground in focus, warm daylight from a window, shallow depth of field.` |
| N5 | Personnalisation — gravure | 4:5 | `Close-up of a black pebbled grained leather pouch with three gold foil-stamped initials "E.P." on the lower right corner, the brushed silver zipper-pull plate with engraved spiral monogram visible above, ivory background, soft studio light.` |
| N6 | Journal / réseaux — flat lay | 4:5 | `Flat lay on white linen: black pebbled grained leather pouch with brushed silver spiral-monogram zipper plate, a pair of sunglasses, a folded newspaper, a small espresso cup, Mediterranean morning light, elegant, restrained.` |
| N7 | Lookbook — Paris | 2:3 | `Editorial fashion photograph, elegant woman in a black coat crossing a Haussmann boulevard at dusk, holding a black pebbled grained leather pouch with its brushed silver spiral-monogram plate turned to camera, soft rain reflections, timeless.` |
| N8 | Écrin / cadeau | 3:2 | `Studio photograph, matte black magnetic gift box open, black pebbled grained leather pouch inside on black tissue, the brushed silver spiral-monogram zipper-pull plate catching a single highlight, dark grey background, luxury unboxing.` |

Negative prompt photos : `text, watermark, other logo, gold hardware, shiny patent leather, brown leather, extra straps, deformed hands, blurry monogram`

---

## 5. Post-production & encodage

1. **Boucle** : plans sans visage (01, 02, 03, 04, 06) → ping-pong (clip + clip inversé). Plans avec personne (05, 07, 08) → fondu croisé de 12 images fin → début, ou demander « seamless loop » à Higgsfield.
2. **Grain** : 3 % de grain 35 mm, léger, sur tous les plans.
3. **Picto** : vérifier plan par plan à 200 % ; incruster `picto_white_trim.png` si nécessaire (tracking sur la plaque).
4. **Encodage** (exécuter pour chaque plan) :
   ```
   ffmpeg -i in.mov -an -c:v libx264 -profile:v high -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart out.mp4
   ffmpeg -i in.mov -an -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 out.webm
   ffmpeg -i out.mp4 -vframes 1 -q:v 2 poster.jpg
   ```
5. **Poids maximum** : hero 2,5 Mo, hero mobile 1,8 Mo, autres ≤ 1,2 Mo. Si dépassé : baisser la durée avant la qualité.

---

## 6. Livrables et rangement

```
output/
  video/   hero-sunset.mp4 .webm .jpg(poster)
           hero-sunset-mobile.mp4 .webm .jpg
           signature-ecrin.mp4 .webm .jpg
           film-01-ouverture.mp4 .webm .jpg
           film-02-empreinte.mp4 .webm .jpg   (+ film-02-empreinte-4x5.mp4)
           campagne-riviera.mp4 .webm .jpg
           lookbook-port.mp4 .webm .jpg
           lookbook-palais.mp4 .webm .jpg
  photo/   N1-macro-zip.jpg … N8-ecrin.jpg  (+ .webp 1920 px et 680 px)
  RAPPORT.md   → par plan : variante retenue, picto natif ou incrusté, poids, ce qui a été refusé et pourquoi
```

**Ne rien écrire dans `uploads/Ellia-Paris/`.** L'intégration au site (balises `<video autoplay muted loop playsinline poster>`, fallback photo sur mobile et `prefers-reduced-motion`, nouvelle section « Le Film ») est une phase 2, après validation de Sacha sur les fichiers d'`output/`.

---

## 7. Critères de refus (un seul suffit)

- La pochette, la plaque ou une main se déforme, même un peu.
- Le picto n'est pas la spirale ELLIA, ou il est illisible / caché.
- La caméra bouge.
- Le plan « fait pub » : mouvement rapide, lueur bleue, effet visible d'IA.
- Texte, watermark, doré sur le métal, cuir brun ou vernis.

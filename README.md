# ContactsLettres.jsx — lettres qui se touchent dans une ligne (Illustrator)

Script Adobe Illustrator (ExtendScript) qui **trouve, dans les textes vivants, les lettres qui se touchent, se chevauchent ou sont trop proches à l'intérieur d'une même ligne**, en mesurant la **forme réelle des lettres** (et non leurs boîtes). Il **corrige ensuite par crénage la seule paire concernée**, juste assez pour atteindre l'écart voulu. En arabe, il ne sépare jamais deux lettres liées.

> ⚠️ **Non testé dans Illustrator.** La syntaxe (ES3/ES5) et la logique ont été vérifiées hors Illustrator (voir « État des tests »). Travaillez sur une **copie** de votre fichier.

## Ce que le script détecte

- **Lettres latines** (et autres écritures) : crénage ou approche trop serrés, `f)`, `f?`, `f’`, `l’`, une italique collée contre une romaine (`f` italique + `)` romaine), un approche négatif, des contours (filets) de lettres qui se touchent.
- **Arabe** :
  - lettres **non liées** qui se heurtent : queues de ر ز و ن ى contre le mot suivant, lettres à crochet ;
  - lettres liées **jamais comparées entre elles**, puisqu'elles sont censées se toucher ;
  - les types de liaison Unicode (T/C/R/D/U) sont respectés, y compris le tatweel ـ et le ZWJ/ZWNJ.
- **Signes** (diacritiques arabes, accents combinants) qui heurtent une lettre voisine.
- **Signes arabes empilés** qui se touchent (chadda + voyelle…). Ils sont **seulement signalés**, car le crénage ne peut pas les corriger.

Pour chaque problème, le script indique :
- la paire et le texte concernés ;
- l'écart mesuré (négatif = chevauchement) ;
- le type ;
- l'action : corrigé, non corrigeable (lettres liées) ou plafond atteint.

## L'écart minimal (« Usage »)

| Préréglage | Écart |
|---|---|
| Typographie | contact seulement (les lettres ne doivent pas se toucher) |
| Lisibilité | 1 % du corps |
| Découpe vinyle / plotter | 0,3 mm |
| Gravure / découpe laser | 0,5 mm |
| Broderie | 1 mm |
| Personnalisé | en pt, mm ou % du corps |

L'épaisseur des contours de texte est soustraite de l'écart. Les grands plans de travail (échelle ×10) sont pris en compte.

## Comment ça marche

1. Le texte est dupliqué sur un **calque temporaire**. Chaque caractère reçoit une **couleur-code unique**, puis la copie est vectorisée. Chaque forme vectorisée est ainsi rattachée à **son** caractère, même avec des ligatures, des formes contextuelles arabes ou du texte sur un tracé.
2. Les courbes sont aplaties avec une tolérance d'environ 1/2000 du cadratin. Le script calcule ensuite la **distance exacte entre les contours** de deux lettres, trous compris (un « o » placé dans le creux d'un « T » n'est pas un chevauchement).
3. Pour corriger, il calcule le **déplacement minimal** qui donne l'écart voulu (profil par bandes, puis recherche dichotomique sur la distance exacte). Il traduit ce déplacement en crénage sur la bonne frontière : le sens du crénage est **calibré** au lancement et vérifié pour le texte de droite à gauche. Enfin, il **revectorise et revérifie**, en 5 passes au plus.
4. Le crénage d'origine est mémorisé dans une étiquette invisible du texte (`ContactsLettresKern`). Le bouton **« Rétablir le crénage »** le remet tel quel, même après plusieurs corrections.
5. Le calque temporaire est toujours supprimé. Les repères (cercle rouge = chevauchement, orange = trop proche, bleu = non corrigeable, vert = corrigé, avec l'écart mesuré) vont sur un calque **non imprimable et verrouillé**, « Contacts lettres – repères ».

## Pourquoi c'est nouveau (vérifié le 2026-10-17)

Recherches faites sur le web et dans les forums Adobe : aucun outil gratuit, payant ou natif ne fait cela dans Illustrator.

- **Illustrator (natif)** :
  - le crénage optique ou métrique règle l'approche, mais ne garantit ni un écart mesuré ni l'absence de contact ;
  - aucune vérification n'existe ;
  - les forums Adobe confirment que l'API ne donne pas la forme des glyphes (« Illustrator Scripting: position text based on glyph bounds », « JSX accessing GlyphBounds », « Overlap characters »).
- **InDesign** :
  - le contrôle en amont ne détecte pas les glyphes qui se touchent ;
  - le script d'Id-Extras « roman–italic collisions » repère seulement les passages italique → romain par recherche de texte, sans mesurer de formes.
- **Graphic Design Stack Exchange** (« Is there any tool, script, or plug-in… that would detect overlapping characters or diacritics? ») : réponse « No, there is none ». Le script CollisionsInterlignes.jsx du même auteur traite seulement les contacts **entre** lignes.
- **GitHub** : une recherche de dépôts « illustrator kerning collision glyph overlap » ne donne aucun résultat. Une recherche de code (createOutline + kerning) ne trouve que des crénages de centrage optique (swwwitch/illustrator-scripts), sans détection de contact. Les collections creold, Sato, Wundes, Ladygin, m1b et Kelso ont déjà été passées en revue pour CollisionsInterlignes.
- **Outils de dessin de police** (Touché pour Glyphs/RoboFont, KernTool4) : ils testent les paires d'une police **en cours de création**, pas un document Illustrator avec ses corps, approches, contours et mélanges de polices.
- **Outils de découpe** (VectorFirstAid, Cut File Checker de VectoSolve, Pathfinder) : ils travaillent sur des tracés déjà vectorisés (points proches, tracés ouverts). Aucun ne mesure l'écart entre lettres d'un texte vivant ni ne le corrige par crénage.

## Installation

1. Téléchargez `ContactsLettres.jsx`.
2. Choisissez l'une des deux méthodes :
   - **Ponctuel** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl/Cmd + F12), puis choisissez le fichier.
   - **Permanent** : copiez le fichier dans le dossier des scripts d'Illustrator, puis redémarrez Illustrator. Le script apparaît dans *Fichier > Scripts*.
     - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts\`
     - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts/`
     - Remplacez `fr_FR` par la langue de votre Illustrator.

## Utilisation

1. Sélectionnez un ou plusieurs textes, ou choisissez la portée *Plan de travail actif* ou *Document*.
2. Lancez le script, choisissez l'**usage** (écart minimal) et les **contrôles** voulus.
3. Cliquez sur **Analyser** pour voir les problèmes sans rien modifier : liste, repères et rapport `.txt`. Cliquez sur **Corriger** (ou *Corriger maintenant* depuis le résultat) pour créner les paires concernées.
4. **Sélectionner les textes** sélectionne les textes à problème. **Effacer les repères** supprime le calque de repères. **Rétablir le crénage** remet le crénage d'origine des paires corrigées.

Options :
- comparer chaque lettre avec 1, 2 ou 3 lettres suivantes ;
- ignorer les polices cursives liées : écriture manuscrite détectée automatiquement, ou par le nom ;
- liste de polices à ignorer ;
- longueur maximale des textes ;
- plafond de crénage ajouté (1/1000 cadratin) ;
- repères et étiquettes.

Les réglages sont mémorisés dans `ContactsLettres.cfg` (dossier de données utilisateur). Pour exclure un texte, ajoutez `#contacts-ok` dans sa note (panneau Attributs).

Le dialogue s'affiche en français, ou en anglais si Illustrator est en anglais.

## Limites connues

- Ignorés : les textes chaînés (plusieurs blocs), les textes verticaux, les textes verrouillés ou masqués, et les textes au-delà de la longueur maximale (3000 caractères par défaut).
- Seuls les contacts **dans une ligne** sont traités. Pour les contacts entre lignes, voir CollisionsInterlignes.jsx.
- Les textes déjà vectorisés ne sont pas analysés. Les effets d'aspect (décalage, contours ajoutés par l'Aspect) sont ignorés : seuls la forme des lettres et le contour du caractère comptent.
- Texte sur un tracé : l'axe de séparation est estimé d'après les centres des deux lettres.
- Sur une paire corrigée, un crénage automatique (métrique ou optique) est remplacé par une valeur manuelle équivalente, majorée de la correction.
- Une correction peut changer la coupure des lignes dans un texte captif. Le résultat le signale (« Textes recomposés »).
- Lettres arabes liées, ou signes mal placés par la police : le problème est signalé, mais n'est pas corrigeable par crénage.
- Annulation : les modifications sont annulables (*Édition > Annuler*). Le nombre d'étapes d'annulation selon la version d'Illustrator **n'a pas été vérifié**. Le bouton « Rétablir le crénage » reste disponible.

## Version ciblée

Illustrator CC 2018 à 2026 (ExtendScript ES3, ScriptUI), Windows et macOS.

## État des tests

- **Non testé dans Illustrator.**
- Syntaxe vérifiée avec `acorn --ecma3` et `acorn --ecma5` : OK.
- `node test/core.test.js` : **64 tests** du moteur pur, tous réussis.
  - Unicode et liaisons arabes, paires, couleurs-codes (200 000 index) ;
  - aplatissement des courbes, distances exactes et trous ;
  - 600 tests aléatoires du déplacement minimal ;
  - crénage itératif, étiquettes, unités, détection cursive.
- `node test/dom.test.js` : **72 tests** sur un **DOM Illustrator simulé** (police fictive), tous réussis.
  - `f)` corrigé dans les deux conventions de crénage, puis rétabli ;
  - perte du crénage automatique (AV) ;
  - arabe : بب ignoré, رب corrigé, signes empilés ;
  - approche −200, texte tourné et mis à l'échelle, texte sur cercle, contours ;
  - mm et % du corps, document RVB ;
  - dialogues simulés : aucun document, rien de sélectionné, valeur invalide ;
  - paragraphe de 392 caractères.
- Le DOM simulé ne garantit pas le comportement réel d'Illustrator, en particulier la vectorisation des polices arabes et le sens réel du crénage, qui est pourtant calibré au lancement. Les retours de tests réels sont bienvenus.

## Confidentialité

Aucun appel réseau, aucune collecte de données. Seul un fichier de réglages local est écrit, plus le rapport si vous l'enregistrez.

## Licence

MIT — Copyright (c) 2026 Amirouche Amwanes.

---

## English summary

**ContactsLettres.jsx** finds letters that touch, overlap or sit too close **within a line** of live text in Adobe Illustrator.

- **How it measures:** it uses the real outlines of each glyph, taken from a temporary outlined copy with per-character colour codes, and computes the exact contour-to-contour distance, holes included.
- **How it fixes:** it kerns only the offending pair, by the minimal amount needed to reach the target gap. Presets: contact, 1 % of size, 0.3 mm for vinyl, 0.5 mm for laser, 1 mm for embroidery, or a custom value.
- **What it checks:** Latin pairs (`f)`, italic against roman, tight tracking), Arabic non-joined letters and neighbouring words (it never separates joined letters), and diacritics against letters. Stacked Arabic marks are reported only.
- **Output:** non-printing markers, a .txt report, and one-click restore of the original kerning.
- **Novelty:** no native, free or paid tool does this for an Illustrator document.
- **Requirements:** French/English UI, ES3, Illustrator CC 2018–2026.
- **Status:** **not tested inside Illustrator.** Syntax checked; 64 engine tests and 72 tests on a simulated DOM pass.

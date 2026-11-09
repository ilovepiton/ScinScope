# Reference Refinement Assets

The UI follows the user's ten-phone SkinScope mockup. The sixteen illustrated
tiles are custom raster artwork, not Unicode emoji or a system emoji font.

## Closer Mockup Pass

- `mockup-icons.png` replaces the chunky 3D atlas with the reference's soft 2D
  shading, pink face and hair, flat yellow crown, orange flame, outlined phone,
  blue camera and purple gallery. Prompt used the original ten-phone mockup as
  the style source and requested fixed 4 by 4 cells, no text, no progress rings,
  no clay rendering. Disc clipping and glyph compositing are CSS-only; the
  generated source is preserved. The earlier atlas remains for history.
  Runtime header metrics use the existing clean SVG flame/crown/phone; camera,
  gallery and anonymous avatar retain the earlier transparent artwork. Crown
  level badges use a white-outlined gold vector shape and real level text.
- `analysis-photos.png` is a generated 2:1 photographic atlas. Left is a
  pink-peach skin macro with fine pores/furrows, no identifiable face or lesion;
  right is the reference's short white/red tube beside a taller blue tube on
  an ice-blue background. No real product claims or invented user results.

Source generations are retained in the Codex generated-images directory. A
background-removal candidate with visible artifacts was rejected, not shipped.

## Generated Images

Generated with the built-in image tool and stored in the project:

- `reference-icons.png`: square 4 x 4 transparent atlas. Reference style is the
  soft sculpted skincare art in the user's screenshot. Ordered face, pore patch,
  follicle, drop, nose, tone spheres, sun, products, shield, target, crown,
  flame, phone, camera, gallery and profile. Equal cells, no labels, no UI.
- `soap-bottle.png`: realistic white satin-plastic SkinScope soap bottle,
  straight-on product photograph on transparent alpha, separate visible pump
  head, stem and collar, nozzle pointing right. CSS masks the head and body from
  the same aligned image so only the pump head moves during the press.

## Recorded Sound

`soap-pump.mp3` is **Soap dispenser** by **txirimiri**, published April 23, 2013.

- Original: https://freesound.org/people/txirimiri/sounds/185784/
- File: https://cdn.freesound.org/previews/185/185784_3061860-hq.mp3
- License: Creative Commons Zero (CC0),
  https://creativecommons.org/publicdomain/zero/1.0/

This is a real recorded dispenser, not synthesized noise. It is played quietly
only after a deliberate tap. The speaker icon mutes it and remembers the choice.
Skip never plays audio. The earlier Mixkit candidate is not shipped because its
license restricts redistributing the original audio with source files.

The cream is an opaque, rounded animated ribbon and settling dollop. No mist,
steam or spray particles are emitted. Reduced-motion users skip these effects.

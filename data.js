// Порядок разделов здесь совпадает с порядком обложек на полке.
const collections = [
  {
    id: "ai-generated",
    name: "AI Generated",
    about: "Material tests from an imaginary studio.",
    posts: [
      { image: "cast-blue", title: "Half cast", alt: "A curved piece of blue resin on pale paper", note: "A test of how much blue can fit inside a shadow." },
      { image: "silver-fold", title: "One continuous fold", alt: "A folded silver ribbon in soft studio light", note: "Trying to make a sheet of metal feel as light as a strip of film." },
      { image: "amber-disc", title: "Late light", alt: "Amber glass catching a low light", note: "The reflection was more interesting than the object. Keeping both for now." }
    ]
  },
  {
    id: "photo",
    name: "Photo",
    about: "Corners, intervals and small interruptions in the street.",
    posts: [
      { image: "linen-field", date: "2026-11-24T12:06:00Z", width: 508, height: 679, title: "Wind in the linen", alt: "An ivory shirt moving in a field of dry grass", note: "A portrait study in the few seconds before the wind settles." },
      { image: "alpine-hour", date: "2026-11-24T12:05:00Z", width: 508, height: 337, title: "Last light on the ridge", alt: "A snowy mountain catching the last pink light", note: "Two temperatures in one frame: cool snow and the last strip of sun." },
      { image: "concrete-arc", date: "2026-11-24T12:04:00Z", width: 508, height: 679, title: "Under the spiral", alt: "A curved concrete stair rising against the sky", note: "Looking for a curve in a material that usually reads as weight." },
      { image: "sea-line", date: "2026-11-24T12:03:00Z", width: 508, height: 337, title: "Break line", alt: "White foam on a deep green wave", note: "A coastline drawn and erased in the same second." },
      { image: "red-room", date: "2026-11-24T12:02:00Z", width: 508, height: 679, title: "Red room", alt: "A blurred figure in an amber darkroom", note: "An experiment in how little detail a portrait needs." },
      { image: "moving-shadow", date: "2026-11-24T12:01:00Z", width: 508, height: 337, title: "Moving shadow", alt: "Leaf shadows stretched across a warm terracotta wall", note: "Keeping the shadow in focus while its source stays outside the frame." },
      { image: "concrete-corner", title: "The corner opposite", alt: "A monochrome view looking up at a concrete facade", note: "A study of the thin line where two faces of a building meet." },
      { image: "court", title: "Between games", alt: "A green court crossed by a fence shadow", note: "The painted lines and the shadow make two different courts." },
      { image: "chairs", title: "After closing", alt: "Empty chairs with long dark shadows", note: "Part of a sequence about the spaces people leave behind." }
    ]
  },
  {
    id: "site-inspirations",
    name: "Site Inspirations",
    about: "Imagined websites, collected for their type and rhythm.",
    posts: [
      { image: "red-index", title: "A red interruption", alt: "A cream editorial layout interrupted by oversized red type", note: "An editorial homepage study. One oversized letter breaks the reading order." },
      { image: "blue-layout", title: "Room for a caption", alt: "An architectural layout with blue lettering", note: "A layout sketch for a small architecture practice. The margins carry most of the weight." },
      { image: "green-index", title: "Olive index", alt: "An olive typographic layout with light columns", note: "An early directory design built around narrow columns and left-aligned titles." }
    ]
  },
  {
    id: "design-sketches",
    name: "Design Sketches",
    about: "Drawings and paper models with decisions still open.",
    posts: [
      { image: "chair-lines", title: "One bent tube", alt: "Pencil construction lines for a tubular chair", note: "Working out where the backrest should turn into a leg." },
      { image: "paper-model", title: "Small cantilever", alt: "A folded card model lit from one side", note: "A folded-paper test for a shelf that might be too long." },
      { image: "ink-page", title: "Margin forms", alt: "Bold black ink shapes on a sketchbook page", note: "Brush marks from the edge of a page, brought into the middle." }
    ]
  },
  {
    id: "experiments",
    name: "Experiments",
    about: "A place for material accidents worth keeping.",
    posts: [
      { image: "torn-paper", title: "Along the tear", alt: "A torn cream paper edge against terracotta", note: "Letting the grain decide where two colours meet." },
      { image: "acetate", title: "A third colour", alt: "Overlapping translucent sheets of yellow and violet", note: "Two sheets of acetate and a patch of daylight." },
      { image: "ink-repeat", title: "Slightly out", alt: "Repeated blue ink circles on warm paper", note: "A registration error that gave the print its rhythm." }
    ]
  },
  {
    id: "notes",
    name: "Notes",
    about: "Fragments saved for another afternoon.",
    posts: [
      { image: "notebook", title: "Desk observation", alt: "A loose pencil study on lined notebook paper", note: "One object, a soft pencil and the last few minutes of daylight." },
      { image: "swatches", title: "Keep this red", alt: "Paper colour swatches and a red strip beside an envelope", note: "A colour pairing tucked into an envelope for later." },
      { image: "book-cloth", title: "Cloth samples", alt: "Small pieces of grey book cloth taped to card", note: "Testing a cover material by folding the offcuts across the grain." }
    ]
  }
];

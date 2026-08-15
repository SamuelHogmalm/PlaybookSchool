/**
 * Source-frame crops produced by the importer, one per beat.
 *
 * Files live in `public/dev-repairs/crops` and are named after the play as it appears
 * in the PDF, which is not always the play's display name — `Relax*` is filed as
 * `Relax`. The mapping lives here so a renamed crop breaks one function, not a page.
 */

function slugForCrop(playName: string): string {
  return playName.replace(/[^A-Za-z0-9-]/g, "");
}

/** Public URL of the source crop for a beat, 1-based to match the filenames. */
export function cropUrl(playName: string, beatIndex: number): string {
  return `/dev-repairs/crops/${slugForCrop(playName)}_beat${beatIndex + 1}.png`;
}

export { slugForCrop };

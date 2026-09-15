/**
 * Majors for the Major dropdown (onboarding and Edit profile).
 *
 * Students pick a UMN Twin Cities undergraduate major, or choose "Other"
 * (always the last option) and type their own. Both end up in the same
 * profiles.major text column, so majors typed before the dropdown existed
 * keep working and the database needs no list of its own.
 *
 * THE LIST: every program marked Major on https://majors.umn.edu/ as of
 * 2026-09-14, with the B.A. and B.S. versions of a major merged into one
 * entry (the degree doesn't matter for finding study partners), sorted,
 * with "Undecided" first. When UMN adds or renames a major, edit it here;
 * nothing else needs to change.
 */

/** The dropdown value for "Other". Deliberately not a real major name, so
 *  nothing a student types can be mistaken for it. */
export const MAJOR_OTHER = "__other__";

export const MAJORS: readonly string[] = [
  "Undecided",
  "Accounting",
  "Acting",
  "Aerospace Engineering and Mechanics",
  "African American and African Studies",
  "Agricultural and Food Business Management",
  "Agricultural Communication and Marketing",
  "Agricultural Education",
  "American Indian Studies",
  "American Studies",
  "Animal Science",
  "Anthropology",
  "Apparel Design",
  "Applied Economics",
  "Architecture",
  "Art",
  "Art History",
  "Arts Education",
  "Asian and Middle Eastern Studies",
  "Astrophysics",
  "Bachelor of Individualized Studies",
  "Biochemistry",
  "Biology",
  "Biology, Society, and Environment",
  "Biomedical Engineering",
  "Bioproducts and Biosystems Engineering",
  "Business Analytics",
  "Business and Marketing Education",
  "Cellular and Organismal Physiology",
  "Chemical Engineering",
  "Chemistry",
  "Chicano & Latino Studies",
  "Civil Engineering",
  "Classical and Near Eastern Religions and Cultures",
  "Communication Studies",
  "Computer Engineering",
  "Computer Science",
  "Construction Management",
  "Cultural Studies and Comparative Literature",
  "Dakota Language",
  "Dance",
  "Data Science",
  "Dental Hygiene",
  "Developmental Psychology",
  "Early Childhood",
  "Earth Sciences",
  "Ecology, Evolution and Behavior",
  "Economics",
  "Economics - Business Economics",
  "Economics - Quantitative",
  "Electrical Engineering",
  "Elementary Education Foundations",
  "English",
  "Entrepreneurial Management",
  "Environmental Engineering",
  "Environmental Geosciences",
  "Environmental Sciences, Policy and Management",
  "Family Social Science",
  "Finance",
  "Finance & Risk Management Insurance",
  "Fisheries, Wildlife, and Conservation Biology",
  "Food Science",
  "Forest and Natural Resource Management",
  "French and Italian Studies",
  "French Studies",
  "Gender, Women and Sexuality Studies",
  "Genetics, Cell Biology, and Development",
  "Geoengineering",
  "Geography",
  "German, Scandinavian, Dutch",
  "Global Studies",
  "Graphic Design",
  "Health and Wellbeing Sciences",
  "Health Services Management",
  "History",
  "Human Physiology",
  "Human Resource Development",
  "Human Resources and Industrial Relations",
  "Individually Designed Interdepartmental",
  "Industrial and Systems Engineering",
  "Information Technology Infrastructure",
  "Inter-College Program",
  "Interdisciplinary Computing: Computational Linguistics",
  "Interdisciplinary Computing: Geographic Information Science",
  "Interdisciplinary Computing: Neural Engineering",
  "Interdisciplinary Computing: Operations and Information Engineering",
  "Interdisciplinary Computing: Psychology and Computing",
  "Interdisciplinary Computing: Retail Data Science",
  "Interior Design",
  "International Business",
  "Italian Studies",
  "Jewish Studies",
  "Journalism",
  "Kinesiology",
  "Landscape Architecture",
  "Linguistics",
  "Management Information Systems",
  "Marketing",
  "Materials Science and Engineering",
  "Mathematics",
  "Mechanical Engineering",
  "Media and Information",
  "Medical Laboratory Sciences",
  "Microbiology",
  "Mortuary Sciences",
  "Multidisciplinary Studies",
  "Music",
  "Music Education",
  "Music Therapy",
  "Neuroscience",
  "Nursing",
  "Nutrition",
  "Ojibwe Language",
  "Philosophy",
  "Physical Activity and Health Promotion",
  "Physics",
  "Plant and Microbial Biology",
  "Plant Science",
  "Political Science",
  "Product Design",
  "Psychology",
  "Public & Nonprofit Management",
  "Public Health",
  "Religious Studies",
  "Retail and Consumer Studies",
  "Russian",
  "Sociology",
  "Sociology of Law, Criminology, and Justice",
  "Spanish and Portuguese Studies",
  "Spanish Studies",
  "Special Education",
  "Speech-Language-Hearing Sciences",
  "Sport Management",
  "Statistical Practice",
  "Statistical Science",
  "Strategic Communication: Advertising and Public Relations",
  "Studies in Cinema and Media Culture",
  "Supply Chain & Operations Management",
  "Sustainable Agriculture and Food Systems",
  "Sustainable Systems Management",
  "Technical Writing and Communication",
  "Theatre Arts",
  "Urban Studies",
  "User Experience (UX)",
  "Youth Studies",
];

/** The list's own spelling of a major, matched ignoring case and spacing. */
function listed(value: string): string | undefined {
  const key = value.replace(/\s+/g, " ").trim().toLowerCase();
  return MAJORS.find((major) => major.toLowerCase() === key);
}

/**
 * What the dropdown and the Other box start with for a saved major. A saved
 * value matching a list entry (ignoring case and spacing) selects it, and
 * saving again stores the list's spelling; anything else opens as Other
 * with the text filled in.
 */
export function majorChoiceFor(saved: string | null | undefined): {
  choice: string;
  other: string;
} {
  const value = saved?.trim() ?? "";
  if (!value) return { choice: "", other: "" };
  const match = listed(value);
  return match ? { choice: match, other: "" } : { choice: MAJOR_OTHER, other: value };
}

/**
 * The one major a submitted form stands for: the picked major, the typed
 * one when Other is picked (in the list's spelling if it's on the list), or
 * "" for Prefer not to say. Other with nothing typed returns undefined,
 * which the profile schema reports as "Type your major, or pick one from
 * the list." instead of quietly saving no major.
 */
export function majorFromForm(
  choice: FormDataEntryValue | null,
  other: FormDataEntryValue | null,
): string | undefined {
  const isOther = choice === MAJOR_OTHER;
  const picked = isOther ? other : choice;
  const value = typeof picked === "string" ? picked.trim() : "";
  if (isOther && !value) return undefined;
  return value ? (listed(value) ?? value) : "";
}

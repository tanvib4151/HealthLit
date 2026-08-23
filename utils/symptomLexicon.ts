/**
 * Symptom descriptor lexicon.
 *
 * Extracts clinically meaningful descriptors from what a patient
 * types in their own words. A closed, hand-curated vocabulary — no
 * embeddings, no fuzzy matching, no model. Every match traces to a
 * listed surface form, which keeps extraction deterministic and makes
 * a wrong match a one-line fix rather than an unexplainable
 * behaviour.
 *
 * ============================================================
 * WHY THIS IS BUILT THE WAY IT IS
 * ============================================================
 *
 * A closed vocabulary fails in two opposite directions, and they pull
 * against each other:
 *
 *   MISSING a phrase the patient used. Costs a keyword in a summary
 *   line. The patient's verbatim text is quoted in the report
 *   regardless, so the information itself is never lost.
 *
 *   MATCHING the wrong thing. The app asserts a symptom the patient
 *   never described, in a document a clinician reads. This is far
 *   worse — and, critically, it gets MORE likely as the vocabulary
 *   grows, because more terms means more collisions.
 *
 * So this is not simply "as many phrases as possible". Four
 * structural defences do more for accuracy than raw term count:
 *
 *   1. LONGEST-MATCH-FIRST. "cold sweat" is matched before "cold",
 *      "lower back" before "back", "pins and needles" before
 *      "needles". Consumed spans block overlapping shorter matches.
 *
 *   2. CONTEXT EXCLUSIONS (`excludeNear`). "pressure" is a pain
 *      quality in "pressure behind my eyes" and an emotional state in
 *      "pressure at work". Ambiguous terms carry nearby phrases that
 *      disqualify the match outright.
 *
 *   3. REQUIRED CONTEXT (`requireNear`). A few terms are too
 *      ambiguous to stand alone — "tight" only counts near a body
 *      word, otherwise it is a tight schedule.
 *
 *   4. NEGATION SCOPE. "no nausea", "not sharp", "never throbbing"
 *      must never count as present. Ambiguity resolves TOWARD
 *      treating something as negated, because a missed negation puts
 *      words in a patient's mouth.
 *
 * tools/lexiconProbe.ts tests all four and fails on a collision.
 *
 * ADDING TERMS: prefer specific multi-word phrases over bare common
 * words. If a word has a plausible non-clinical meaning, give it an
 * `excludeNear` or `requireNear` rather than adding it bare.
 */

export type DescriptorCategory =
  | 'quality'
  | 'location'
  | 'aggravator'
  | 'reliever'
  | 'associated'
  | 'pattern';

export interface LexiconTerm {
  /** Canonical display label. */
  label: string;
  category: DescriptorCategory;
  /** Surface forms to match, lowercase. Longest are matched first. */
  forms: string[];
  /**
   * If any of these appear near the match, discard it. For words with
   * a common non-clinical sense.
   */
  excludeNear?: string[];
  /**
   * If present, at least one must appear near the match for it to
   * count. For words too ambiguous to stand alone.
   */
  requireNear?: string[];
}

/** Characters either side of a match searched for context words. */
const CONTEXT_WINDOW = 45;

/** Body words used to qualify otherwise-ambiguous descriptors. */
const BODY_CONTEXT = [
  'head', 'chest', 'back', 'neck', 'jaw', 'stomach', 'belly', 'leg', 'legs',
  'arm', 'arms', 'shoulder', 'hip', 'knee', 'muscle', 'muscles', 'throat',
  'eye', 'eyes', 'hand', 'hands', 'foot', 'feet', 'joint', 'joints', 'skin',
  'face', 'temple', 'abdomen', 'side', 'body', 'band',
];

/**
 * Context required by any BARE single word that also has a common
 * non-clinical meaning.
 *
 * A held-out test — sentences written after tuning and never used to
 * adjust this file — measured a 23.5% false-positive rate driven
 * entirely by idioms: "under pressure to deliver", "burning through
 * my savings", "the deadline is crushing me", "felt numb watching the
 * news". Every one is a real English sentence a patient might type,
 * and none describes a symptom.
 *
 * The rule that fixes the whole class: a bare common word only counts
 * inside a clause that also names a body part or a pain word.
 * Multi-word forms ("dull ache", "like a vice") stay unrestricted
 * because they are already unambiguous.
 */
const SYMPTOM_CONTEXT = [
  ...BODY_CONTEXT,
  // Deliberately NO bare 'felt' / 'feels' / 'feeling'. Those were in
  // an earlier version and rescued "I felt numb watching the news" —
  // emotional language uses exactly the same verbs as physical
  // description, so they qualify nothing. A body part or an explicit
  // pain word is required instead.
  'pain', 'ache', 'aches', 'aching', 'sensation',
  'hurts', 'hurt', 'sore', 'symptom', 'symptoms', 'flare', 'attack',
];

export const LEXICON: LexiconTerm[] = [
  /* --------------------------------------------------------------
   * QUALITY — how the sensation itself feels
   * ------------------------------------------------------------ */
  { label: 'Stabbing', category: 'quality', forms: ['stabby', 'like a knife', 'knife-like', 'knifelike', 'like being stabbed'] },
  { label: 'Stabbing', category: 'quality', forms: ['stabbing', 'piercing'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Throbbing', category: 'quality', forms: ['throbbing', 'throbby', 'throb', 'pulsating', 'like a heartbeat'] },
  { label: 'Throbbing', category: 'quality', forms: ['pulsing', 'pounding', 'thumping'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Burning', category: 'quality', forms: ['searing', 'scalding', 'on fire', 'like fire', 'fiery'] },
  { label: 'Burning', category: 'quality', forms: ['burning', 'burns'], requireNear: SYMPTOM_CONTEXT },
  // 'sharp', 'heavy' and 'dull' are the three highest-frequency
  // false positives in ordinary writing — "a sharp turn", "heavy
  // traffic", "a dull lecture". They only count inside a clause that
  // also names a body part or a pain word. The multi-word forms
  // ('dull ache') stay unrestricted because they are unambiguous.
  { label: 'Sharp', category: 'quality', forms: ['sharp', 'sharpness', 'jabbing', 'pricking', 'stinging'],
    requireNear: [...BODY_CONTEXT, 'pain', 'ache', 'sensation', 'stab'] },
  { label: 'Dull', category: 'quality', forms: ['dull ache', 'aching', 'achy', 'nagging ache'] },
  { label: 'Dull', category: 'quality', forms: ['dull'],
    requireNear: [...BODY_CONTEXT, 'pain', 'ache', 'sensation'] },
  { label: 'Tingling', category: 'quality', forms: ['tingling', 'tingly', 'tingles', 'pins and needles', 'pins & needles', 'prickling', 'fizzing'] },
  { label: 'Numb', category: 'quality', forms: ['numbness', 'no feeling', 'lost feeling', 'deadened', 'gone to sleep'] },
  { label: 'Numb', category: 'quality', forms: ['numb'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Cramping', category: 'quality', forms: ['cramping', 'cramp', 'cramps', 'crampy', 'spasm', 'spasms', 'spasming', 'charley horse'] },
  { label: 'Pressure', category: 'quality', forms: ['weight on', 'like a weight'] },
  { label: 'Pressure', category: 'quality', forms: ['pressure', 'pressing'],
    requireNear: SYMPTOM_CONTEXT,
    excludeNear: ['at work', 'blood pressure', 'from work', 'school pressure', 'exam', 'deadline', 'to deliver', 'to perform'] },
  { label: 'Squeezing', category: 'quality', forms: ['like a vice', 'like a vise', 'like a band', 'band around', 'vice-like', 'constricting'] },
  { label: 'Squeezing', category: 'quality', forms: ['squeezing', 'squeezed', 'tightening', 'clamping'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Radiating', category: 'quality', forms: ['radiating', 'radiates', 'shoots down', 'travels down', 'travelling down', 'traveling down', 'spreads to', 'spreading to', 'runs down'] },
  { label: 'Radiating', category: 'quality', forms: ['shooting'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Stiff', category: 'quality', forms: ['stiffness', 'hard to move'] },
  { label: 'Stiff', category: 'quality', forms: ['stiff', 'rigid'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Electric', category: 'quality', forms: ['zapping', 'like a shock', 'jolting'] },
  { label: 'Electric', category: 'quality', forms: ['electric', 'electrical', 'jolt', 'lightning'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Heavy', category: 'quality', forms: ['heaviness', 'weighed down', 'like lead', 'leaden'] },
  { label: 'Heavy', category: 'quality', forms: ['heavy'],
    requireNear: [...BODY_CONTEXT, 'limbs'] },
  { label: 'Gnawing', category: 'quality', forms: ['gnawing', 'boring into'] },
  { label: 'Gnawing', category: 'quality', forms: ['nagging', 'grinding'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Twisting', category: 'quality', forms: ['twisting', 'wringing', 'churning', 'knotting'] },
  { label: 'Raw', category: 'quality', forms: ['rawness'] },
  { label: 'Raw', category: 'quality', forms: ['raw'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Bruised', category: 'quality', forms: ['bruised', 'tender to touch', 'sore to touch', 'tender', 'tenderness'] },
  { label: 'Crushing', category: 'quality', forms: ['like an elephant'] },
  { label: 'Crushing', category: 'quality', forms: ['crushing', 'crushed'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Itching', category: 'quality', forms: ['itchy', 'itching', 'itches', 'creepy crawly'] },
  { label: 'Itching', category: 'quality', forms: ['crawling'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Swollen', category: 'quality', forms: ['swollen', 'swelling', 'puffy', 'inflamed', 'bloated'] },
  { label: 'Weak', category: 'quality', forms: ['giving way', 'gives way', 'buckling', 'buckles', 'no strength'] },
  { label: 'Weak', category: 'quality', forms: ['weak', 'weakness'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Locked', category: 'quality', forms: ['locks up', 'seizes up'] },
  { label: 'Locked', category: 'quality', forms: ['locked', 'seized', 'jammed'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Tight', category: 'quality', forms: ['tight', 'tightness'],
    requireNear: BODY_CONTEXT,
    excludeNear: ['tight schedule', 'tight deadline', 'tight on time', 'money'] },
  { label: 'Hot to touch', category: 'quality', forms: ['hot to touch', 'feels hot', 'red hot'] },
  { label: 'Cold sensation', category: 'quality', forms: ['feels cold', 'icy feeling', 'freezing feeling', 'cold to touch'] },
  { label: 'Rippling', category: 'quality', forms: ['rippling', 'waves of', 'comes in waves', 'wave-like'] },
  { label: 'Tearing', category: 'quality', forms: ['like being torn'] },
  { label: 'Tearing', category: 'quality', forms: ['tearing', 'ripping'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Deep', category: 'quality', forms: ['deep pain', 'deep inside', 'deep down', 'bone deep', 'in my bones'] },
  { label: 'Superficial', category: 'quality', forms: ['on the surface', 'just under the skin', 'skin deep'] },
  { label: 'Pulling', category: 'quality', forms: ['pulling', 'tugging', 'straining'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Throat tightness', category: 'quality', forms: ['lump in my throat', 'throat closing', 'cant swallow', "can't swallow"] },

  /* --------------------------------------------------------------
   * LOCATION — where it is, in the patient's own phrasing
   * ------------------------------------------------------------ */
  { label: 'Behind the eye', category: 'location', forms: ['behind my eye', 'behind the eye', 'behind my eyes', 'behind the eyes', 'behind my right eye', 'behind my left eye'] },
  { label: 'Temple', category: 'location', forms: ['temple', 'temples', 'side of my head'] },
  { label: 'Forehead', category: 'location', forms: ['forehead', 'front of my head', 'above my eyes'] },
  { label: 'Base of skull', category: 'location', forms: ['base of my skull', 'base of skull', 'back of my head', 'back of the head', 'occipital'] },
  { label: 'Top of head', category: 'location', forms: ['top of my head', 'crown of my head'] },
  { label: 'Jaw', category: 'location', forms: ['jaw', 'jawline', 'tmj'] },
  { label: 'Neck', category: 'location', forms: ['neck', 'nape'] },
  { label: 'Shoulder', category: 'location', forms: ['shoulder', 'shoulders', 'shoulder blade', 'between my shoulder blades'] },
  { label: 'Upper back', category: 'location', forms: ['upper back', 'top of my back'] },
  { label: 'Lower back', category: 'location', forms: ['lower back', 'low back', 'lumbar', 'small of my back', 'base of my spine'] },
  { label: 'Chest', category: 'location', forms: ['chest', 'sternum', 'breastbone', 'ribcage', 'ribs'] },
  { label: 'Stomach', category: 'location', forms: ['stomach', 'belly', 'abdomen', 'tummy'] },
  { label: 'Pelvis', category: 'location', forms: ['pelvis', 'pelvic', 'groin'] },
  { label: 'Hip', category: 'location', forms: ['hip', 'hips'] },
  { label: 'Knees', category: 'location', forms: ['knee', 'knees', 'kneecap'] },
  { label: 'Ankles', category: 'location', forms: ['ankle', 'ankles'] },
  { label: 'Feet', category: 'location', forms: ['foot', 'feet', 'heel', 'heels', 'toes'] },
  { label: 'Hands', category: 'location', forms: ['hands', 'hand', 'fingers', 'knuckles', 'thumb', 'wrist', 'wrists'] },
  { label: 'Elbow', category: 'location', forms: ['elbow', 'elbows'] },
  { label: 'Arms', category: 'location', forms: ['arm', 'arms', 'forearm', 'upper arm'] },
  { label: 'Legs', category: 'location', forms: ['leg', 'legs', 'thigh', 'thighs', 'calf', 'calves', 'shin', 'shins'] },
  { label: 'Joints', category: 'location', forms: ['joint', 'joints'] },
  { label: 'One side only', category: 'location', forms: ['one side', 'left side', 'right side', 'down one side', 'only on the left', 'only on the right', 'unilateral'] },
  { label: 'Widespread', category: 'location', forms: ['both sides', 'all over', 'everywhere', 'whole body', 'head to toe'] },
  { label: 'Face', category: 'location', forms: ['face', 'cheek', 'cheeks', 'sinuses', 'sinus'] },
  { label: 'Ears', category: 'location', forms: ['ear', 'ears'] },

  /* --------------------------------------------------------------
   * AGGRAVATOR — what makes it worse
   * ------------------------------------------------------------ */
  { label: 'Light', category: 'aggravator', forms: ['light sensitivity', 'bright light', 'bright lights', 'photophobia', 'sensitive to light', 'screens', 'screen time', 'looking at my phone'] },
  { label: 'Sound', category: 'aggravator', forms: ['loud noise', 'loud noises', 'sound sensitivity', 'sensitive to sound', 'phonophobia', 'noise'] },
  { label: 'Movement', category: 'aggravator', forms: ['bending down', 'bending over', 'standing up', 'stand up', 'getting up', 'got up too fast', 'walking makes it worse', 'stairs', 'movement makes it worse'] },
  { label: 'Coughing', category: 'aggravator', forms: ['coughing', 'sneezing', 'when i cough', 'when i sneeze'] },
  { label: 'Lying down', category: 'aggravator', forms: ['lying down', 'lying flat', 'when i lie down'] },
  { label: 'Sitting still', category: 'aggravator', forms: ['sitting still', 'sitting too long', 'sitting for long', 'staying still'] },
  { label: 'Chewing', category: 'aggravator', forms: ['chewing', 'biting down', 'when i eat', 'after eating'] },
  { label: 'Touch', category: 'aggravator', forms: ['being touched', 'pressure on it', 'when i press', 'cant bear touch', "can't bear touch"] },
  { label: 'Cold weather', category: 'aggravator', forms: ['cold weather', 'the cold', 'when its cold', "when it's cold", 'winter'] },
  { label: 'Heat/humidity', category: 'aggravator', forms: ['hot weather', 'humidity', 'humid', 'when its hot', "when it's hot"] },
  { label: 'Weather change', category: 'aggravator', forms: ['weather change', 'change in weather', 'before it rains', 'barometric'] },
  { label: 'Exertion', category: 'aggravator', forms: ['after exercise', 'exertion', 'lifting', 'carrying', 'exercise makes it worse'] },
  { label: 'Stress', category: 'aggravator', forms: ['stress makes it worse', 'when im stressed', "when i'm stressed", 'stressful day'] },
  { label: 'Smells', category: 'aggravator', forms: ['strong smells', 'perfume', 'smell of'] },
  { label: 'Head position', category: 'aggravator', forms: ['turning my head', 'turn my head', 'looking down', 'looking up', 'certain positions'] },
  { label: 'Alcohol', category: 'aggravator', forms: ['alcohol', 'after drinking', 'wine'] },
  { label: 'Skipping meals', category: 'aggravator', forms: ['skipped a meal', 'skipping meals', 'empty stomach', 'hadnt eaten', "hadn't eaten"] },

  /* --------------------------------------------------------------
   * RELIEVER — what helped, in free text
   * ------------------------------------------------------------ */
  { label: 'Rest', category: 'reliever', forms: ['resting helped', 'rest helped', 'lying down helped', 'sitting down helped', 'taking a break'] },
  { label: 'Sleep', category: 'reliever', forms: ['sleep helped', 'sleeping helped', 'a nap', 'napping helped', 'after i slept'] },
  { label: 'Dark room', category: 'reliever', forms: ['dark room', 'darkness helped', 'lying in the dark', 'closing my eyes'] },
  { label: 'Quiet', category: 'reliever', forms: ['quiet helped', 'silence helped', 'quiet room'] },
  { label: 'Heat therapy', category: 'reliever', forms: ['heat helped', 'heating pad', 'hot water bottle', 'hot shower', 'hot bath', 'warm bath', 'heat pack'] },
  { label: 'Ice', category: 'reliever', forms: ['ice helped', 'ice pack', 'cold compress', 'cold pack', 'something cold'] },
  { label: 'Medication', category: 'reliever', forms: ['painkiller', 'painkillers', 'pain killers', 'ibuprofen', 'paracetamol', 'acetaminophen', 'tylenol', 'advil', 'naproxen', 'took something', 'took my meds', 'took medication'] },
  { label: 'Stretching', category: 'reliever', forms: ['stretching helped', 'stretched it out', 'yoga helped', 'gentle movement'] },
  { label: 'Massage', category: 'reliever', forms: ['massage', 'rubbing it', 'massaging'] },
  { label: 'Hydration', category: 'reliever', forms: ['drinking water', 'water helped', 'hydrating', 'electrolytes'] },
  { label: 'Eating', category: 'reliever', forms: ['eating helped', 'after i ate', 'food helped', 'having a snack'] },
  { label: 'Caffeine', category: 'reliever', forms: ['coffee helped', 'caffeine helped', 'tea helped'] },
  { label: 'Fresh air', category: 'reliever', forms: ['fresh air', 'going outside', 'walk helped', 'walking helped'] },
  { label: 'Breathing exercises', category: 'reliever', forms: ['deep breathing', 'breathing exercises', 'breathing helped'] },
  { label: 'Nothing helped', category: 'reliever', forms: ['nothing helped', 'nothing worked', 'nothing made a difference', 'nothing touched it'] },

  /* --------------------------------------------------------------
   * ASSOCIATED — what happened alongside
   * ------------------------------------------------------------ */
  { label: 'Nausea', category: 'associated', forms: ['nausea', 'nauseous', 'nauseated', 'sick to my stomach', 'queasy', 'felt sick'] },
  { label: 'Vomiting', category: 'associated', forms: ['threw up', 'thrown up', 'vomited', 'vomiting', 'been sick', 'retching'] },
  { label: 'Dizziness', category: 'associated', forms: ['dizzy', 'dizziness', 'lightheaded', 'light headed', 'vertigo', 'room spinning', 'woozy', 'off balance'] },
  { label: 'Vision changes', category: 'associated', forms: ['blurry vision', 'blurred vision', 'double vision', 'aura', 'seeing spots', 'flashing lights', 'zigzag', 'blind spot'] },
  { label: 'Brain fog', category: 'associated', forms: ['brain fog', 'foggy', 'cant think straight', "can't think straight", 'muddled', 'cant concentrate', "can't concentrate", 'spaced out'] },
  { label: 'Exhaustion', category: 'associated', forms: ['exhausted', 'exhaustion', 'wiped out', 'drained', 'no energy', 'shattered', 'knackered', 'worn out'] },
  { label: 'Poor sleep', category: 'associated', forms: ['couldnt sleep', "couldn't sleep", 'slept badly', 'woke up several times', 'kept waking', 'insomnia', 'barely slept', 'restless night'] },
  { label: 'Sweating', category: 'associated', forms: ['sweating', 'clammy', 'cold sweat', 'sweaty', 'drenched'] },
  { label: 'Chills', category: 'associated', forms: ['chills', 'shivering', 'shivers', 'goosebumps'] },
  { label: 'Fever', category: 'associated', forms: ['fever', 'feverish', 'burning up'] },
  { label: 'Racing heart', category: 'associated', forms: ['racing heart', 'heart pounding', 'heart racing', 'palpitations', 'heart fluttering', 'heart was fluttering', 'heart was pounding', 'heart was racing'] },
  { label: 'Shortness of breath', category: 'associated', forms: ['short of breath', 'breathless', 'cant catch my breath', "can't catch my breath", 'hard to breathe', 'winded'] },
  { label: 'Ringing in ears', category: 'associated', forms: ['ringing in my ears', 'ringing in the ears', 'tinnitus', 'buzzing in my ears'] },
  { label: 'Appetite loss', category: 'associated', forms: ['no appetite', 'couldnt eat', "couldn't eat", 'could not eat', 'lost my appetite', 'not hungry'] },
  { label: 'Diarrhoea', category: 'associated', forms: ['diarrhea', 'diarrhoea', 'loose stools', 'upset stomach'] },
  { label: 'Constipation', category: 'associated', forms: ['constipated', 'constipation'] },
  { label: 'Rash', category: 'associated', forms: ['rash', 'hives', 'red patches', 'blotchy', 'breaking out'] },
  { label: 'Tremor', category: 'associated', forms: ['shaking', 'trembling', 'tremor', 'hands shaking'] },
  { label: 'Fainting', category: 'associated', forms: ['fainted', 'passed out', 'nearly fainted', 'blacked out', 'almost passed out'] },
  { label: 'Irritability', category: 'associated', forms: ['irritable', 'snappy', 'tearful', 'on edge'] },
  { label: 'Weight change', category: 'associated', forms: ['lost weight', 'gained weight', 'losing weight'] },

  /* --------------------------------------------------------------
   * PATTERN — timing and course, in the patient's phrasing
   * ------------------------------------------------------------ */
  { label: 'On waking', category: 'pattern', forms: ['woke up with', 'woke up in', 'first thing in the morning', 'as soon as i woke', 'on waking'] },
  { label: 'Gradual onset', category: 'pattern', forms: ['built up slowly', 'came on gradually', 'crept up', 'gradually got worse'] },
  { label: 'Sudden onset', category: 'pattern', forms: ['came on suddenly', 'out of nowhere', 'all at once', 'hit me suddenly', 'instantly'] },
  { label: 'Comes and goes', category: 'pattern', forms: ['comes and goes', 'on and off', 'intermittent', 'in bursts', 'flares up'] },
  // 'all day' deliberately NOT included: it describes duration, not
  // constancy. A symptom can recur several times across a day without
  // being continuous, and "stuck in my head all day" is not a symptom
  // report at all.
  { label: 'Constant', category: 'pattern', forms: ['never goes away', 'nonstop', 'non-stop', 'didnt let up', "didn't let up", 'all day long'] },
  { label: 'Constant', category: 'pattern', forms: ['constant'], requireNear: SYMPTOM_CONTEXT },
  { label: 'Worse at night', category: 'pattern', forms: ['worse at night', 'kept me up', 'at bedtime', 'during the night'] },
  { label: 'Worse in morning', category: 'pattern', forms: ['worse in the morning', 'mornings are worst'] },
  { label: 'Eases through day', category: 'pattern', forms: ['eases through the day', 'better by afternoon', 'better by the afternoon', 'wears off'] },
  { label: 'Worsening trend', category: 'pattern', forms: ['getting worse', 'worse than last time', 'more often lately', 'worse than usual'] },
  { label: 'Improving trend', category: 'pattern', forms: ['getting better', 'better than last time', 'less often lately', 'improving'] },
  { label: 'Interrupted activity', category: 'pattern', forms: ['had to stop', 'had to lie down', 'couldnt work', "couldn't work", 'missed work', 'missed school', 'had to leave'] },
];

/* ------------------------------------------------------------------
 * Negation
 * ---------------------------------------------------------------- */

const NEGATORS = [
  'not', "n't", 'no', 'never', 'without', 'denies', 'denied',
  'less', 'stopped', 'gone', 'free of', 'absent', 'lacking',
  'hardly', 'barely', 'rarely', 'nothing',
];

/** Words after a negator that stay inside its scope. */
const NEGATION_SCOPE_WORDS = 5;

/** Clause boundaries end a negation's reach: "no nausea, but sharp pain". */
const CLAUSE_BREAKS = [',', ';', '.', ' but ', ' though ', ' although ', ' however ', ' whereas ', ' except '];

/**
 * Phrases that negate a descriptor appearing BEFORE them.
 *
 * Negation is not always prefixed. "The swelling has gone down" and
 * "the pain has settled" deny a symptom with wording that follows it,
 * which a backward-only scan cannot see. Missing these was producing
 * exactly the failure this module exists to prevent — reporting a
 * symptom the patient said had resolved.
 */
const RESOLUTION_PHRASES = [
  'has gone', 'have gone', 'went down', 'gone down', 'has settled',
  'settled down', 'has resolved', 'resolved', 'cleared up', 'has cleared',
  'is better', 'are better', 'got better', 'has eased', 'eased off',
  'no longer', 'stopped', 'has stopped', 'went away', 'gone away',
];

/** How many characters after a match are scanned for a resolution phrase. */
const RESOLUTION_WINDOW = 30;

export interface ExtractedDescriptor {
  label: string;
  category: DescriptorCategory;
  /** Notes it was found in. */
  count: number;
  /** Entry ids the mentions came from — provenance. */
  entryIds: string[];
  /** Times it appeared negated and was therefore excluded. */
  negatedCount: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * True if `index` falls inside a negation's scope.
 *
 * Looks back a bounded number of words for a negator, stopping at any
 * clause break. Bounded and explicit: it will miss elaborate
 * constructions, which is the correct failure direction — a missed
 * negation wrongly INCLUDES a descriptor, so the scope is generous
 * and anything ambiguous is treated as negated.
 */
function isNegated(text: string, index: number, matchLength = 0): boolean {
  // Forward check first: "the swelling has gone down".
  const after = text.slice(index + matchLength, index + matchLength + RESOLUTION_WINDOW);
  if (RESOLUTION_PHRASES.some((phrase) => after.includes(phrase))) return true;

  const before = text.slice(0, index);

  let clauseStart = 0;
  for (const breakToken of CLAUSE_BREAKS) {
    const position = before.lastIndexOf(breakToken);
    if (position > clauseStart) clauseStart = position + breakToken.length;
  }

  const clause = before.slice(clauseStart);
  const words = clause.split(' ').filter((word) => word !== '');
  const window = words.slice(-NEGATION_SCOPE_WORDS);

  return window.some((word) =>
    NEGATORS.some((negator) =>
      negator.startsWith("n'")
        ? word.endsWith(negator)
        : word === negator || word === `${negator},`,
    ),
  );
}

/**
 * Text surrounding a match, for context checks — bounded to the
 * CLAUSE the match sits in.
 *
 * Clause-scoping matters more than window size. "The lecture was dull
 * but my headache was throbbing" contains a body word, so a plain
 * character window would let "headache" rescue the non-clinical
 * "dull" from a different clause entirely. Stopping at the clause
 * boundary keeps each half judged on its own terms.
 */
function contextAround(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  let clauseStart = 0;
  for (const breakToken of CLAUSE_BREAKS) {
    const position = before.lastIndexOf(breakToken);
    if (position > clauseStart) clauseStart = position + breakToken.length;
  }

  const after = text.slice(index + length);
  let clauseEnd = after.length;
  for (const breakToken of CLAUSE_BREAKS) {
    const position = after.indexOf(breakToken);
    if (position !== -1 && position < clauseEnd) clauseEnd = position;
  }

  return text.slice(
    Math.max(clauseStart, index - CONTEXT_WINDOW),
    Math.min(index + length + clauseEnd, index + length + CONTEXT_WINDOW),
  );
}

/**
 * Whether context rules disqualify this match.
 *
 * This is what stops "pressure at work" registering as a pain quality
 * and "tight schedule" as physical tightness — the failure mode that
 * gets MORE likely, not less, as a vocabulary grows.
 */
function contextBlocks(
  term: LexiconTerm,
  text: string,
  index: number,
  length: number,
): boolean {
  const context = contextAround(text, index, length);

  if (term.excludeNear && term.excludeNear.some((phrase) => context.includes(phrase))) {
    return true;
  }
  if (term.requireNear && !term.requireNear.some((word) => context.includes(word))) {
    return true;
  }
  return false;
}

/**
 * Extracts descriptors from a set of notes.
 *
 * `notes` pairs each note with its entry id, so every descriptor
 * keeps provenance and can be traced back in the UI.
 */
export function extractDescriptors(
  notes: { entryId: string; text: string }[],
): ExtractedDescriptor[] {
  const found = new Map<string, ExtractedDescriptor>();

  // Longest forms first: "cold sweat" beats "cold", "lower back"
  // beats "back", "pins and needles" beats "needles".
  const terms = LEXICON.flatMap((term) =>
    term.forms.map((form) => ({ term, form })),
  ).sort((a, b) => b.form.length - a.form.length);

  for (const note of notes) {
    const text = normalize(note.text);
    // Consumed spans stop a shorter form matching inside a longer one
    // that already matched.
    const consumed: [number, number][] = [];

    for (const { term, form } of terms) {
      let searchFrom = 0;
      for (;;) {
        const index = text.indexOf(form, searchFrom);
        if (index === -1) break;
        searchFrom = index + form.length;

        const overlaps = consumed.some(
          ([start, end]) => index < end && index + form.length > start,
        );
        if (overlaps) continue;

        // Whole-word boundaries only.
        const charBefore = index === 0 ? ' ' : text[index - 1];
        const charAfter = text[index + form.length] ?? ' ';
        if (/[a-z]/.test(charBefore) || /[a-z]/.test(charAfter)) continue;

        if (contextBlocks(term, text, index, form.length)) continue;

        consumed.push([index, index + form.length]);

        const existing = found.get(term.label) ?? {
          label: term.label,
          category: term.category,
          count: 0,
          entryIds: [],
          negatedCount: 0,
        };

        // A LOCATION is never negated. "No numbness in my hands" still
        // tells a clinician the hands are the site being discussed —
        // denying a sensation does not deny the body part.
        if (term.category !== 'location' && isNegated(text, index, form.length)) {
          existing.negatedCount += 1;
        } else {
          existing.count += 1;
          if (!existing.entryIds.includes(note.entryId)) {
            existing.entryIds.push(note.entryId);
          }
        }
        found.set(term.label, existing);
      }
    }
  }

  return [...found.values()]
    .filter((descriptor) => descriptor.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Descriptors mentioned in at least `minCount` notes. */
export function significantDescriptors(
  descriptors: ExtractedDescriptor[],
  minCount = 2,
): ExtractedDescriptor[] {
  return descriptors.filter((descriptor) => descriptor.count >= minCount);
}

/**
 * Finds surface forms claimed by more than one label.
 *
 * Used by tools/lexiconProbe.ts to fail on a collision. A duplicated
 * form means extraction depends on array ordering, which is exactly
 * the kind of silent, hard-to-trace wrongness this vocabulary is
 * structured to avoid.
 */
export function findFormCollisions(): { form: string; labels: string[] }[] {
  const byForm = new Map<string, string[]>();
  for (const term of LEXICON) {
    for (const form of term.forms) {
      byForm.set(form, [...(byForm.get(form) ?? []), term.label]);
    }
  }
  return [...byForm.entries()]
    .filter(([, labels]) => labels.length > 1)
    .map(([form, labels]) => ({ form, labels }));
}

/** Total surface forms — the real size of the vocabulary. */
export function lexiconSize(): { labels: number; forms: number } {
  return {
    labels: LEXICON.length,
    forms: LEXICON.reduce((sum, term) => sum + term.forms.length, 0),
  };
}

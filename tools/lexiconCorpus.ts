/**
 * Labeled corpus for measuring lexicon accuracy.
 *
 * Each case pairs a piece of text with the descriptors that SHOULD be
 * extracted from it. Anything the extractor returns that is not in
 * `expect` counts as a false positive.
 *
 * CORPUS DESIGN
 *
 * Four groups, deliberately weighted toward the hard cases rather
 * than the easy ones:
 *
 *   clinical    Normal symptom descriptions. Positive controls —
 *               these check the lexicon still finds real content.
 *
 *   distractor  Text that USES lexicon words in a non-clinical sense.
 *               "pressure at work", "tight deadline", "sharp turn".
 *               Most expect NOTHING, and they are where a large
 *               vocabulary does its damage.
 *
 *   negated     Symptoms explicitly denied. Extracting these is as
 *               harmful as inventing them outright.
 *
 *   mixed       Real-world messiness: a negation and an assertion in
 *               one sentence, non-clinical and clinical uses of the
 *               same word, clauses that flip mid-sentence.
 *
 * HONEST LIMITATION: I wrote both this corpus and the lexicon, so
 * there is real risk of unconsciously testing only what I already
 * handled. The distractor set is deliberately built from everyday
 * sentences a patient might plausibly type, not from words I knew
 * were safe. A corpus written by someone else would be a stronger
 * test, and real user notes stronger still.
 */

export interface LexiconTestCase {
  group: 'clinical' | 'distractor' | 'negated' | 'mixed';
  text: string;
  /** Labels that SHOULD be extracted. Anything else is a false positive. */
  expect: string[];
}

export const LEXICON_CORPUS: LexiconTestCase[] = [
  /* ---------------------- clinical (positive controls) ------------- */
  { group: 'clinical', text: 'Throbbing pain behind my right eye since this morning.', expect: ['Throbbing', 'Behind the eye'] },
  { group: 'clinical', text: 'Sharp stabbing pain in my lower back when I stand up.', expect: ['Sharp', 'Stabbing', 'Lower back', 'Movement'] },
  // 'all day' was originally labelled as Constant here. That was a
  // mislabelled expectation on my part, not a lexicon gap: all day
  // describes DURATION, and a symptom can recur repeatedly across a
  // day without being continuous. Corrected rather than worked around.
  { group: 'clinical', text: 'Dull ache across both shoulders all day.', expect: ['Dull', 'Shoulder'] },
  { group: 'clinical', text: 'Pins and needles in my left hand.', expect: ['Tingling', 'Hands'] },
  { group: 'clinical', text: 'Burning sensation down the back of my leg.', expect: ['Burning', 'Legs'] },
  { group: 'clinical', text: 'Woke up with my jaw locked.', expect: ['On waking', 'Jaw', 'Locked'] },
  { group: 'clinical', text: 'Felt dizzy and lightheaded when I got up too fast.', expect: ['Dizziness', 'Movement'] },
  { group: 'clinical', text: 'Cramping in my calves overnight, kept me up.', expect: ['Cramping', 'Legs', 'Worse at night'] },
  { group: 'clinical', text: 'My knees are swollen and hot to touch.', expect: ['Knees', 'Swollen', 'Hot to touch'] },
  { group: 'clinical', text: 'Nausea all afternoon, threw up once.', expect: ['Nausea', 'Vomiting'] },
  { group: 'clinical', text: 'Electric shooting pain from my neck down one side.', expect: ['Electric', 'Radiating', 'Neck', 'One side only'] },
  { group: 'clinical', text: 'Heavy legs, no energy at all today.', expect: ['Heavy', 'Legs', 'Exhaustion'] },
  { group: 'clinical', text: 'Ringing in my ears started around lunchtime.', expect: ['Ringing in ears'] },
  { group: 'clinical', text: 'Stiff neck, hard to turn my head.', expect: ['Stiff', 'Neck', 'Head position'] },
  { group: 'clinical', text: 'Bright lights made the headache much worse.', expect: ['Light'] },
  { group: 'clinical', text: 'Ibuprofen helped a bit but it came back.', expect: ['Medication'] },
  { group: 'clinical', text: 'Had to lie down in a dark room for two hours.', expect: ['Interrupted activity', 'Dark room'] },
  { group: 'clinical', text: 'Chest felt tight and I was short of breath.', expect: ['Tight', 'Chest', 'Shortness of breath'] },
  { group: 'clinical', text: 'Brain fog all morning, could not concentrate.', expect: ['Brain fog'] },
  { group: 'clinical', text: 'Came on suddenly out of nowhere.', expect: ['Sudden onset'] },
  { group: 'clinical', text: 'Comes and goes throughout the day.', expect: ['Comes and goes'] },
  { group: 'clinical', text: 'Woke up in a cold sweat, heart racing.', expect: ['On waking', 'Sweating', 'Racing heart'] },
  { group: 'clinical', text: 'Skin is itchy with red patches on my arms.', expect: ['Itching', 'Rash', 'Arms'] },
  { group: 'clinical', text: 'Pressure behind my eyes that would not shift.', expect: ['Pressure', 'Behind the eye'] },
  { group: 'clinical', text: 'A heating pad helped more than anything else.', expect: ['Heat therapy'] },
  { group: 'clinical', text: 'Blurry vision and flashing lights before it started.', expect: ['Vision changes'] },
  { group: 'clinical', text: 'Stomach churning, could not eat anything.', expect: ['Stomach', 'Twisting', 'Appetite loss'] },
  { group: 'clinical', text: 'Worse at night, better by the afternoon.', expect: ['Worse at night', 'Eases through day'] },
  { group: 'clinical', text: 'Tender to touch around my ribs.', expect: ['Bruised', 'Chest'] },
  // Likewise 'flare up' here: it marks an aggravating trigger, not a
  // statement that the symptom is intermittent overall.
  { group: 'clinical', text: 'Sneezing makes the pain flare up.', expect: ['Coughing'] },

  /* ---------------------- distractor (the real test) --------------- */
  { group: 'distractor', text: 'A lot of pressure at work this week.', expect: [] },
  { group: 'distractor', text: 'Tight deadline on the project, barely slept.', expect: ['Poor sleep'] },
  { group: 'distractor', text: 'My blood pressure was normal at the check-up.', expect: [] },
  { group: 'distractor', text: 'Took a sharp turn on the drive home.', expect: [] },
  { group: 'distractor', text: 'The exam pressure has been intense.', expect: [] },
  { group: 'distractor', text: 'Money is tight this month.', expect: [] },
  { group: 'distractor', text: 'It was a heavy book to carry around campus.', expect: [] },
  { group: 'distractor', text: 'She has a very dry sense of humour.', expect: [] },
  { group: 'distractor', text: 'The meeting ran long and I was on edge about it.', expect: ['Irritability'] },
  { group: 'distractor', text: 'Watched a film about a cold case investigation.', expect: [] },
  { group: 'distractor', text: 'Cleaned the whole house, moved all the furniture.', expect: [] },
  { group: 'distractor', text: 'The weather has been lovely this week.', expect: [] },
  { group: 'distractor', text: 'Had a really productive day at school.', expect: [] },
  { group: 'distractor', text: 'My phone battery is draining fast.', expect: [] },
  { group: 'distractor', text: 'The traffic was heavy on the way in.', expect: [] },
  { group: 'distractor', text: 'I gained a lot from that conversation.', expect: [] },
  { group: 'distractor', text: 'Sharp increase in prices at the shop.', expect: [] },
  { group: 'distractor', text: 'Feeling positive about the week ahead.', expect: [] },
  { group: 'distractor', text: 'The room was quiet and I got a lot done.', expect: [] },
  { group: 'distractor', text: 'Cold brew coffee from the place near school.', expect: [] },
  { group: 'distractor', text: 'That song has been stuck in my head all day.', expect: [] },
  { group: 'distractor', text: 'Went for a long walk in the park with friends.', expect: [] },
  { group: 'distractor', text: 'The film had a really tense atmosphere.', expect: [] },
  { group: 'distractor', text: 'Made a stir fry with fresh vegetables.', expect: [] },
  { group: 'distractor', text: 'The lecture was dull and hard to follow.', expect: [] },

  /* ---------------------- negated ---------------------------------- */
  { group: 'negated', text: 'No nausea today at all.', expect: [] },
  { group: 'negated', text: 'Not sharp, more of a dull ache.', expect: ['Dull'] },
  { group: 'negated', text: 'Never throbbing, just constant pressure in my head.', expect: ['Constant', 'Pressure'] },
  { group: 'negated', text: 'No dizziness this time.', expect: [] },
  { group: 'negated', text: 'Nothing helped, unfortunately.', expect: ['Nothing helped'] },
  { group: 'negated', text: 'No fever, no chills.', expect: [] },
  { group: 'negated', text: 'Without any tingling in my hands today.', expect: ['Hands'] },
  { group: 'negated', text: 'The swelling has gone down.', expect: [] },
  { group: 'negated', text: 'Barely any pain at all this morning.', expect: [] },
  { group: 'negated', text: 'No vision changes, thankfully.', expect: [] },
  { group: 'negated', text: 'I have not been vomiting.', expect: [] },
  { group: 'negated', text: 'Rarely get brain fog these days.', expect: [] },

  /* ---------------------- mixed ------------------------------------ */
  { group: 'mixed', text: 'No nausea, but the throbbing was severe.', expect: ['Throbbing'] },
  { group: 'mixed', text: 'Pressure at work all week, and pressure behind my eyes by Friday.', expect: ['Pressure', 'Behind the eye'] },
  { group: 'mixed', text: 'Not dizzy, though my chest felt tight.', expect: ['Tight', 'Chest'] },
  { group: 'mixed', text: 'Tight schedule, but also a tight feeling in my chest.', expect: ['Tight', 'Chest'] },
  { group: 'mixed', text: 'No fever but woke up in a cold sweat.', expect: ['On waking', 'Sweating'] },
  { group: 'mixed', text: 'Nothing helped except lying in the dark.', expect: ['Nothing helped', 'Dark room'] },
  { group: 'mixed', text: 'Not stabbing exactly, more burning down my leg.', expect: ['Burning', 'Legs'] },
  { group: 'mixed', text: 'The lecture was dull but my headache was throbbing.', expect: ['Throbbing'] },
];

/**
 * Dad jokes for the days the daily joke card has nothing to show — either the
 * account doesn't get the curated joke, or there are no SFW jokes to serve.
 *
 * Bundled rather than fetched from a joke API: the card has to be the same
 * joke on every reload and every device, and it shouldn't vanish when a
 * third-party site is down.
 */

export const DAD_JOKES = [
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I used to hate facial hair, but then it grew on me.",
  "What do you call a fake noodle? An impasta.",
  "Why did the scarecrow win an award? Because he was outstanding in his field.",
  "I only know 25 letters of the alphabet. I don't know y.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Why couldn't the bicycle stand up by itself? It was two tired.",
  "I would avoid the sushi if I were you. It's a little fishy.",
  "Want to hear a joke about construction? I'm still working on it.",
  "What do you call a bear with no teeth? A gummy bear.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I'm on a seafood diet. I see food and I eat it.",
  "How does a penguin build its house? Igloos it together.",
  "Why did the math book look so sad? Because it had too many problems.",
  "What did the ocean say to the beach? Nothing, it just waved.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why can't you hear a pterodactyl go to the bathroom? Because the P is silent.",
  "What do you call a factory that makes okay products? A satisfactory.",
  "Did you hear about the restaurant on the moon? Great food, no atmosphere.",
  "Why did the coffee file a police report? It got mugged.",
  "What do you call a pile of cats? A meowntain.",
  "How do you organize a space party? You planet.",
  "I don't trust stairs. They're always up to something.",
  "What do you call a sleeping bull? A bulldozer.",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one.",
  "What do you call a man with a rubber toe? Roberto.",
  "How do you make a tissue dance? Put a little boogie in it.",
  "Why do cows wear bells? Because their horns don't work.",
  "I used to play piano by ear, but now I use my hands.",
  "What's brown and sticky? A stick.",
  "Why did the tomato turn red? Because it saw the salad dressing.",
  "What did one wall say to the other? I'll meet you at the corner.",
  "Why don't oysters donate to charity? Because they're shellfish.",
  "What do you call a dinosaur with an extensive vocabulary? A thesaurus.",
  "How does the moon cut his hair? Eclipse it.",
  "Why did the cookie go to the doctor? Because it felt crummy.",
  "What do you call a belt made of watches? A waist of time.",
  "I'm afraid for the calendar. Its days are numbered.",
  "Why do fish live in salt water? Because pepper makes them sneeze.",
  "What do you call an alligator in a vest? An investigator.",
  "Why did the invisible man turn down the job offer? He couldn't see himself doing it.",
  "What kind of shoes do ninjas wear? Sneakers.",
  "Why are elevator jokes so good? They work on many levels.",
  "What do you call a boomerang that won't come back? A stick.",
  "Why did the picture go to jail? Because it was framed.",
  "How do you find Will Smith in the snow? Look for fresh prints.",
  "I made a pencil with two erasers. It was pointless.",
  "What did the grape do when it got stepped on? It let out a little wine.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "What do you call a fish wearing a bowtie? Sofishticated.",
  "How do you throw a party for a fruit? You make it a pear-ty.",
  "What do lawyers wear to court? Lawsuits.",
  "Why did the banana go to the doctor? It wasn't peeling well.",
  "What do you call a cow with no legs? Ground beef.",
  "What did the janitor say when he jumped out of the closet? Supplies!",
  "Why did the cow go to outer space? To see the moooon.",
  "Where do boats go when they're sick? To the dock.",
  "What did the buffalo say to his son when he left for college? Bison.",
  "How do celebrities stay cool? They have many fans.",
  "What do you call a dog that can do magic? A labracadabrador.",
  "Why did the orange stop halfway up the hill? It ran out of juice.",
  "What do you get when you cross a snowman and a vampire? Frostbite.",
  "Why are ghosts bad liars? Because you can see right through them.",
  "What did the zero say to the eight? Nice belt.",
  "Why can't a nose be 12 inches long? Because then it would be a foot.",
  "What do you call a lazy kangaroo? A pouch potato.",
  "Why don't mountains get cold? They wear snowcaps.",
  "Why did the chicken join a band? Because it had the drumsticks.",
  "What do you call a snowman with a six-pack? An abdominal snowman.",
  "Why was the math teacher late? She took the rhombus.",
  "What's orange and sounds like a parrot? A carrot.",
  "Why did the man fall down the well? He couldn't see that well.",
  "What kind of music do mummies listen to? Wrap music.",
  "How do trees access the internet? They log in.",
  "What do you call a group of disorganized cats? A cat-astrophe.",
  "Why did the kid throw the clock out the window? He wanted to see time fly.",
  "What does a house wear? Address.",
  "Why couldn't the leopard play hide and seek? He was always spotted.",
  "What's the best time to go to the dentist? Tooth-hurty.",
  "Why did the gym close down? It just didn't work out.",
  "What did the pirate say on his 80th birthday? Aye matey.",
  "Why do bees have sticky hair? Because they use honeycombs.",
  "I once got fired from a canned juice company. Apparently I couldn't concentrate.",
  "Why did the stadium get hot after the game? All the fans left.",
  "What do you call a deer with no eyes? No idea.",
  "Why was the belt arrested? It was holding up a pair of pants.",
  "How do you get a squirrel to like you? Act like a nut.",
  "What did the fish say when it swam into a wall? Dam.",
  "I ordered a chicken and an egg online. I'll let you know which comes first.",
  "How does a scientist freshen her breath? With experi-mints.",
  "Why did the computer go to the doctor? It had a virus.",
  "What do you call a sad strawberry? A blueberry.",
];

// Stable index for a given day, so a refresh doesn't reshuffle the card.
// Mirrors the hash in affirmations.ts.
function hash(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Today's dad joke. Jokes already saved or thrown away are skipped, so the
 * whole list is walked before anything repeats; once every joke has been ruled
 * on, the saved ones come back round. `seed` (the user id) is mixed in so two
 * people don't get the same joke on the same day.
 */
export function pickDadJoke(dayKey: string, seed: string, ruled: Set<string>, saved: string[]) {
  const unseen = DAD_JOKES.filter((j) => !ruled.has(j));
  const pool = unseen.length ? unseen : saved;
  if (!pool.length) return null;
  return pool[hash(`${dayKey}:${seed}`) % pool.length];
}

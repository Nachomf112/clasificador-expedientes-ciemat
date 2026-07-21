const fragments = require('./fragments.json');

const STOPWORDS = new Set([
  'de','la','el','en','que','y','a','los','las','un','una','para','con','no','se','su','por',
  'es','del','al','lo','como','más','o','este','esta','estos','estas','ya','entre','cuando',
  'muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante',
  'todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes',
  'algunos','qué','unos','yo','otro','otras','otra','él','tanto','esa','estos','mucho','quienes',
  'nada','muchos','cual','poco','ella','estar','estas','algunas','algo','nosotros','mi','mis',
  'tú','te','ti','tu','tus','ellas','nosotras','vosotros','vosotras','os','mío','mía','míos',
  'mías','tuyo','tuya','tuyos','tuyas','suyo','suya','suyos','suyas','nuestro','nuestra',
  'nuestros','nuestras','vuestro','vuestra','vuestros','vuestras','esos','esas','soy','eres',
  'somos','sois','son','sea','seas','seamos','seáis','sean','será','serán','fue','fueron',
  'ser','había','han','ha','he','has','hemos','habéis','artículo','ley','apartado','presente'
]);

function stem(word) {
  // Very light Spanish stemmer: strip common plural/gender suffixes to improve recall.
  if (/^[0-9]+$/.test(word)) return word; // never stem pure numbers
  if (word.length > 5 && word.endsWith('ciones')) return word.slice(0, -3); // -ciones -> -cion
  if (word.length > 5 && word.endsWith('mente')) return word.slice(0, -5); // adverbs
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);   // menores -> menor, contratos handled below
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);    // contratos -> contrato
  return word;
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => (t.length > 2 || /^[0-9]+$/.test(t)) && !STOPWORDS.has(t))
    .map(stem);
}

// Build inverted index + IDF once per cold start
let docTokens = null;
let df = null;
let idf = null;
let N = fragments.length;

function buildIndex() {
  docTokens = fragments.map(f => tokenize(f.text));
  df = {};
  docTokens.forEach(tokens => {
    const seen = new Set(tokens);
    seen.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  idf = {};
  Object.keys(df).forEach(t => {
    idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
  });
}

buildIndex();

function termFreq(tokens) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  return tf;
}

/**
 * Search the fragments corpus for the most relevant chunks to a query.
 * Returns top N fragments with their score.
 */
function search(query, topN = 6) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryTf = termFreq(queryTokens);
  const scores = fragments.map((frag, i) => {
    const tokens = docTokens[i];
    const tf = termFreq(tokens);
    let score = 0;
    Object.keys(queryTf).forEach(t => {
      if (tf[t] && idf[t]) {
        score += (tf[t] / tokens.length) * idf[t] * queryTf[t];
      }
    });
    return { frag, score };
  });

  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.frag);
}

module.exports = { search };

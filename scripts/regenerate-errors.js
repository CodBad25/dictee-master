import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://edcgwxzmdquxwhzvjzmy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2d3eHptZHF1eHdoenZqem15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjY0NzIsImV4cCI6MjA5MDcwMjQ3Mn0.WvnrI_iYAh8a5LBnmdJNKOl6IfeYrSac5Z2-g8131Mg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map of accent characters to their base forms
const accentMap = {
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  à: "a",
  â: "a",
  ä: "a",
  ù: "u",
  û: "u",
  ü: "u",
  ô: "o",
  ö: "o",
  î: "i",
  ï: "i",
  ç: "c",
};

// Common phonetic confusions in French spelling
const phoneticMap = {
  an: ["en"],
  en: ["an", "on"],
  on: ["om", "an"],
  in: ["ain", "en"],
  ain: ["in", "en"],
  eau: ["o", "au"],
  au: ["o", "eau"],
  ou: ["u"],
};

function extractArticleAndWord(fullWord) {
  const articles = ["le ", "la ", "l'", "un ", "une ", "les ", "des ", "du "];
  for (const article of articles) {
    if (fullWord.startsWith(article)) {
      return {
        article,
        word: fullWord.slice(article.length),
      };
    }
  }
  return {
    article: "",
    word: fullWord,
  };
}

function removeAccents(word) {
  return word
    .split("")
    .map((char) => accentMap[char] || char)
    .join("");
}

function generateErrors(fullWord) {
  const { article, word } = extractArticleAndWord(fullWord);
  const errors = new Set();

  // 1. Missing accents
  const noAccents = removeAccents(word);
  if (noAccents !== word && noAccents.length > 0) {
    errors.add(article + noAccents);
  }

  // 2. Missing silent final letters (s, t, d, nt, ent)
  if (word.endsWith("s") && word.length > 2 && word !== "plus" && word !== "pas") {
    errors.add(article + word.slice(0, -1));
  }
  if (word.endsWith("t") && word.length > 2 && !word.endsWith("ent")) {
    errors.add(article + word.slice(0, -1));
  }
  if (word.endsWith("nt") && word.length > 3) {
    errors.add(article + word.slice(0, -2));
  }
  if (word.endsWith("ent") && word.length > 4) {
    errors.add(article + word.slice(0, -3));
  }

  // 3. Double consonant errors
  // Check for double consonants and make them single
  for (let i = 1; i < word.length - 1; i++) {
    if (word[i] === word[i + 1] && /[bcdfghjklmnpqrstvwxyz]/.test(word[i])) {
      const withoutDouble = word.slice(0, i) + word.slice(i + 1);
      errors.add(article + withoutDouble);
    }
  }

  // Check for single consonants in typical double consonant positions and add doubles
  const doubleConsonantWords = {
    patte: "pate",
    trappe: "trape",
    tasse: "tase",
    classe: "clase",
    balle: "bale",
    belle: "bele",
    salle: "sale",
    mille: "mile",
    grille: "grile",
    ille: "ile",
    elle: "ele",
    terre: "tere",
    père: "pere",
    mère: "mere",
    lettre: "letre",
    mettre: "metre",
  };

  for (const [doubleForm, singleForm] of Object.entries(
    doubleConsonantWords
  )) {
    if (word === doubleForm) {
      errors.add(article + singleForm);
    }
    if (word === singleForm) {
      errors.add(article + doubleForm);
    }
  }

  // 4. Missing h (h muet)
  if (word.startsWith("h")) {
    const withoutH = word.slice(1);
    if (withoutH.length > 0) {
      errors.add(article + withoutH);
    }
  }

  // 5. Added h (inverse h error)
  const consonantWords = ["éros", "irondelle", "ameau"];
  if (consonantWords.includes(word)) {
    // Add h before vowel
    const withH = "h" + word;
    errors.add(article + withH);
  }

  // 6. Phonetic confusions
  for (const [original, substitutes] of Object.entries(phoneticMap)) {
    if (word.includes(original)) {
      for (const substitute of substitutes) {
        const confused = word.replace(original, substitute);
        if (confused !== word && confused.length > 0) {
          errors.add(article + confused);
        }
      }
    }
  }

  // 7. Missing silent e at the end
  if (word.endsWith("e") && word.length > 2) {
    const withoutE = word.slice(0, -1);
    // Check if this makes sense (not a common pattern, but sometimes students do this)
    if (
      !withoutE.endsWith("e") &&
      !withoutE.endsWith("t") &&
      !withoutE.endsWith("s")
    ) {
      errors.add(article + withoutE);
    }
  }

  // Convert set to array and filter out duplicates and the original
  const errorsList = Array.from(errors).filter((error) => error !== fullWord);

  // Return unique errors (max 4, but usually 3)
  return errorsList.slice(0, 4);
}

async function regenerateAllErrors() {
  try {
    console.log("Fetching all words from dictee_words...");
    const { data: words, error: fetchError } = await supabase
      .from("dictee_words")
      .select("id, word");

    if (fetchError) {
      console.error("Error fetching words:", fetchError);
      process.exit(1);
    }

    console.log(`Found ${words.length} words. Starting error regeneration...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < words.length; i++) {
      const { id, word } = words[i];

      try {
        const spellingErrors = generateErrors(word);

        const { error: updateError } = await supabase
          .from("dictee_words")
          .update({ spelling_errors: spellingErrors })
          .eq("id", id);

        if (updateError) {
          console.error(`Error updating word "${word}" (ID: ${id}):`, updateError);
          errorCount++;
        } else {
          successCount++;
          if ((i + 1) % 50 === 0) {
            console.log(`Progress: ${i + 1}/${words.length} (${successCount} successful)`);
          }
        }
      } catch (err) {
        console.error(`Exception processing word "${word}" (ID: ${id}):`, err);
        errorCount++;
      }
    }

    console.log("\n=== Regeneration Complete ===");
    console.log(`Total processed: ${words.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errorCount === 0) {
      console.log("All words successfully updated!");
    }
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

regenerateAllErrors();

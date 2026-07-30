/**
 * CategoryDetectionService.js  –  RobotInn Customer Mobile App
 *
 * Intelligent Category Detection Engine:
 * - Exact Match
 * - Singular / Plural Normalization
 * - Multi-word & Substring Token Matching
 * - Case-Insensitive Matching
 * - Alias & Brand Matching
 * - Levenshtein Distance Fuzzy Matching
 * - Fallback to "Other" with manual selection prompt
 */

import KeywordCacheService from './KeywordCacheService';

// Levenshtein distance helper for fuzzy matching
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Singular/Plural stemming helper
function normalizeWord(word) {
  let cleaned = String(word || '').toLowerCase().trim();
  if (cleaned.length > 3 && cleaned.endsWith('ies')) {
    cleaned = cleaned.slice(0, -3) + 'y';
  } else if (cleaned.length > 3 && cleaned.endsWith('es')) {
    cleaned = cleaned.slice(0, -2);
  } else if (cleaned.length > 3 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

class CategoryDetectionService {
  /**
   * Automatically detect category for a given item name.
   * Returns: { categoryId, categoryName, categoryIcon, categoryDetected }
   */
  detectCategory(itemName) {
    if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
      return this.getOtherCategory();
    }

    const rawInput = itemName.trim();
    const normalizedInput = rawInput.toLowerCase();
    const tokens = normalizedInput
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const stemmedTokens = tokens.map(normalizeWord);

    const categoryList = KeywordCacheService.getKeywordList();

    // ── Tier 1: Exact Category Name / ID Match
    for (const cat of categoryList) {
      const catId = String(cat.categoryId).toLowerCase();
      const catName = String(cat.categoryName).toLowerCase();
      if (normalizedInput === catId || normalizedInput === catName) {
        return this.formatCategoryResult(cat, true);
      }
    }

    // ── Tier 2: Exact Keyword or Alias Match
    for (const cat of categoryList) {
      const allKeywords = [...(cat.keywords || []), ...(cat.aliases || [])];
      for (const kw of allKeywords) {
        const kwNorm = String(kw).toLowerCase().trim();
        if (normalizedInput === kwNorm || normalizeWord(normalizedInput) === normalizeWord(kwNorm)) {
          return this.formatCategoryResult(cat, true);
        }
      }
    }

    // ── Tier 3: Multi-Word / Substring Match
    // e.g. "Blue Pen" -> matches "pen" in Stationery
    // e.g. "Fresh Mutton Boneless" -> matches "mutton" in Meat
    // e.g. "Mobile Charger" -> matches "charger" / "mobile" in Electronics
    let bestSubstringMatch = null;
    let maxKeywordLength = 0;

    for (const cat of categoryList) {
      const allKeywords = [...(cat.keywords || []), ...(cat.aliases || [])];
      for (const kw of allKeywords) {
        const kwNorm = String(kw).toLowerCase().trim();
        if (!kwNorm || kwNorm.length < 2) continue;

        const kwStemmed = normalizeWord(kwNorm);

        // Check token level match
        const tokenMatch = tokens.some(
          t => t === kwNorm || normalizeWord(t) === kwStemmed
        );

        // Check substring level match
        const substringMatch = normalizedInput.includes(kwNorm) || kwNorm.includes(normalizedInput);

        if (tokenMatch || substringMatch) {
          if (kwNorm.length > maxKeywordLength) {
            maxKeywordLength = kwNorm.length;
            bestSubstringMatch = cat;
          }
        }
      }
    }

    if (bestSubstringMatch) {
      return this.formatCategoryResult(bestSubstringMatch, true);
    }

    // ── Tier 4: Fuzzy Levenshtein Match (Typo tolerance)
    // Allows matching typos e.g., "Pnacol" -> "Panadol", "Mutton" -> "Muttom"
    let bestFuzzyMatch = null;
    let minDistance = 999;

    for (const cat of categoryList) {
      const allKeywords = [...(cat.keywords || []), ...(cat.aliases || [])];
      for (const kw of allKeywords) {
        const kwNorm = String(kw).toLowerCase().trim();
        if (kwNorm.length < 4) continue;

        for (const token of tokens) {
          if (token.length < 3) continue;
          const dist = levenshteinDistance(token, kwNorm);
          // Allow max 1-2 character difference depending on token length
          const allowedDist = kwNorm.length <= 5 ? 1 : 2;
          if (dist <= allowedDist && dist < minDistance) {
            minDistance = dist;
            bestFuzzyMatch = cat;
          }
        }
      }
    }

    if (bestFuzzyMatch && minDistance <= 2) {
      return this.formatCategoryResult(bestFuzzyMatch, true);
    }

    // ── Tier 5: Fallback to "Other"
    return this.getOtherCategory();
  }

  /**
   * Helper to format successful category detection result
   */
  formatCategoryResult(cat, detected = true) {
    return {
      categoryId: String(cat.categoryId || 'other').toLowerCase(),
      categoryName: cat.categoryName || 'Other',
      categoryIcon: cat.categoryIcon || 'grid-outline',
      categoryDetected: Boolean(detected),
    };
  }

  /**
   * Default fallback "Other" category object
   */
  getOtherCategory() {
    return {
      categoryId: 'other',
      categoryName: 'Other',
      categoryIcon: 'help-circle-outline',
      categoryDetected: false,
    };
  }
}

export default new CategoryDetectionService();

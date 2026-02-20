import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type FoodCategory =
  | "protein"
  | "carbs"
  | "veg"
  | "fruit"
  | "fats"
  | "dairy-free"
  | "plant-based"
  | "other";

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  allergens?: string[];
  offUrl?: string;
  fallback?: boolean;
}

// ─── Hardcoded fallback (used when OFF is unavailable) ────────────────────────

const FALLBACK_FOODS: FoodItem[] = [
  { id: "f01", name: "Chicken Breast", category: "protein", kcal: 165, protein: 31, carbs: 0, fat: 3.6, fallback: true },
  { id: "f02", name: "Salmon Fillet", category: "protein", kcal: 208, protein: 20, carbs: 0, fat: 13, fallback: true },
  { id: "f03", name: "Eggs (whole)", category: "protein", kcal: 143, protein: 13, carbs: 1, fat: 10, fallback: true },
  { id: "f04", name: "Turkey Mince", category: "protein", kcal: 170, protein: 29, carbs: 0, fat: 6, fallback: true },
  { id: "f05", name: "Tofu (firm)", category: "plant-based", kcal: 76, protein: 8, carbs: 2, fat: 4, fallback: true },
  { id: "f06", name: "Brown Rice (cooked)", category: "carbs", kcal: 112, protein: 2.6, carbs: 23, fat: 0.9, fallback: true },
  { id: "f07", name: "Sweet Potato", category: "carbs", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fallback: true },
  { id: "f08", name: "Oats (rolled)", category: "carbs", kcal: 389, protein: 17, carbs: 66, fat: 7, fallback: true },
  { id: "f09", name: "Quinoa (cooked)", category: "carbs", kcal: 120, protein: 4.4, carbs: 22, fat: 2, fallback: true },
  { id: "f10", name: "Broccoli", category: "veg", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fallback: true },
  { id: "f11", name: "Spinach", category: "veg", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fallback: true },
  { id: "f12", name: "Courgette", category: "veg", kcal: 17, protein: 1.2, carbs: 3, fat: 0.3, fallback: true },
  { id: "f13", name: "Kale", category: "veg", kcal: 49, protein: 4.3, carbs: 9, fat: 0.9, fallback: true },
  { id: "f14", name: "Blueberries", category: "fruit", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, fallback: true },
  { id: "f15", name: "Avocado", category: "fats", kcal: 160, protein: 2, carbs: 9, fat: 15, fallback: true },
  { id: "f16", name: "Olive Oil", category: "fats", kcal: 884, protein: 0, carbs: 0, fat: 100, fallback: true },
  { id: "f17", name: "Almonds", category: "fats", kcal: 579, protein: 21, carbs: 22, fat: 50, fallback: true },
  { id: "f18", name: "Walnuts", category: "fats", kcal: 654, protein: 15, carbs: 14, fat: 65, fallback: true },
  { id: "f19", name: "Coconut Milk", category: "dairy-free", kcal: 230, protein: 2.3, carbs: 6, fat: 24, fallback: true },
  { id: "f20", name: "Oat Milk", category: "dairy-free", kcal: 46, protein: 1, carbs: 8, fat: 1.5, fallback: true },
];

// ─── Category guesser ─────────────────────────────────────────────────────────

function guessCategory(name: string, categoryTags: string[]): FoodCategory {
  const lower = name.toLowerCase();
  const tags = categoryTags.join(" ").toLowerCase();

  if (/chicken|beef|salmon|tuna|cod|haddock|trout|mackerel|prawn|shrimp|turkey|pork|lamb|venison|duck|steak|mince|fillet|breast|thigh/.test(lower)) return "protein";
  if (/egg/.test(lower) && !/eggplant|aubergine/.test(lower)) return "protein";
  if (/tofu|tempeh|seitan|edamame/.test(lower) || /plant.based|vegan.protein/.test(tags)) return "plant-based";
  if (/lentil|chickpea|black bean|kidney bean|butter bean|legume/.test(lower)) return "plant-based";
  if (/rice|pasta|noodle|bread|oat|potato|quinoa|barley|couscous|bulgur|polenta|tortilla|cereal|flour|cracker|rye|spelt/.test(lower)) return "carbs";
  if (/sweet potato|yam/.test(lower)) return "carbs";
  if (/broccoli|spinach|kale|carrot|pepper|courgette|zucchini|cucumber|lettuce|cabbage|celery|onion|garlic|mushroom|asparagus|leek|pea|green bean|mangetout|pak choi|bok choy|beetroot|parsnip|cauliflower|aubergine|eggplant|artichoke/.test(lower)) return "veg";
  if (/tomato/.test(lower) && !/sauce|ketchup|paste/.test(lower)) return "veg";
  if (/apple|banana|berry|blueberry|strawberry|raspberry|orange|mango|grape|melon|pear|peach|plum|cherry|kiwi|pineapple|papaya|fig|date|raisin|dried fruit/.test(lower)) return "fruit";
  if (/avocado|olive oil|coconut oil|almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|nut|seed|tahini|peanut butter|chia|flaxseed|hemp seed/.test(lower)) return "fats";
  if (/oat milk|almond milk|coconut milk|rice milk|soy milk|hazelnut milk|cashew milk/.test(lower)) return "dairy-free";

  return "other";
}

// ─── OFF fetch ────────────────────────────────────────────────────────────────

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  nutriments?: Record<string, number>;
  allergens_tags?: string[];
  categories_tags?: string[];
  image_front_small_url?: string;
}

async function fetchFromOFF(query: string): Promise<FoodItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query);
    url.searchParams.set("json", "1");
    url.searchParams.set("fields", "code,product_name,product_name_en,nutriments,allergens_tags,categories_tags,image_front_small_url");
    url.searchParams.set("lc", "en");
    url.searchParams.set("cc", "gb");
    url.searchParams.set("page_size", "24");
    url.searchParams.set("sort_by", "popularity");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "NesemaHealth/1.0 (contact@nesema.com)" },
    });

    if (!res.ok) throw new Error(`OFF ${res.status}`);

    const data = await res.json() as { products?: OFFProduct[] };
    const products = data.products ?? [];

    const items: FoodItem[] = [];
    for (const p of products) {
      const name = (p.product_name_en || p.product_name || "").trim();
      if (!name) continue;

      const n = p.nutriments ?? {};
      let kcal = Math.round(n["energy-kcal_100g"] ?? 0);
      if (!kcal && n["energy_100g"]) kcal = Math.round(n["energy_100g"] / 4.184);
      if (!kcal) continue;

      const protein = Math.round((n["proteins_100g"] ?? 0) * 10) / 10;
      const carbs = Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10;
      const fat = Math.round((n["fat_100g"] ?? 0) * 10) / 10;

      const allergens = (p.allergens_tags ?? []).map((t) => t.replace(/^en:/, ""));
      const catTags = (p.categories_tags ?? []).map((t) => t.replace(/^en:/, ""));
      const category = guessCategory(name, catTags);

      items.push({
        id: p.code || `off-${name}`,
        name,
        category,
        kcal,
        protein,
        carbs,
        fat,
        image: p.image_front_small_url || undefined,
        allergens: allergens.length ? allergens : undefined,
        offUrl: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : undefined,
      });
    }
    return items;
  } finally {
    clearTimeout(timeout);
  }
}

const getCachedFoods = unstable_cache(
  fetchFromOFF,
  ["off-food-search"],
  { revalidate: 86400 } // 24 hours
);

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "chicken breast").trim() || "chicken breast";

  try {
    const foods = await getCachedFoods(q);
    return NextResponse.json({ foods, fallback: false });
  } catch {
    return NextResponse.json({ foods: FALLBACK_FOODS, fallback: true });
  }
}

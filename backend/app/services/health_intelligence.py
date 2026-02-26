"""
Health Intelligence Service

Computes a deterministic Health Index based on the 5-CNL (Nutri-Score) system,
then uses Claude for qualitative insights (good/bad habits, narrative, etc.).
"""

import json
import re
import anthropic
from typing import Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session

from ..config import get_settings

settings = get_settings()


# ---------------------------------------------------------------------------
# Nutri-Score category keyword dictionaries (Indian food delivery context)
# Each dish is classified into one of 5 categories based on keyword matching.
# Raw scores map to the adapted Nutri-Score scale (-15 to +40).
# ---------------------------------------------------------------------------

# Category A — Excellent (raw score ~ -7)
_CAT_A_KEYWORDS = [
    'grilled', 'steamed', 'tandoori', 'tikka', 'salad', 'bowl',
    'dal', 'daal', 'dhal', 'lentil', 'rasam', 'sambar', 'sambhar',
    'idli', 'appam', 'ragi', 'millet', 'oats', 'quinoa',
    'grilled chicken', 'grilled fish', 'grilled paneer',
    'boiled egg', 'egg white', 'poha', 'upma',
    'sprout', 'raita', 'curd', 'yogurt', 'buttermilk', 'chaas',
    'soup', 'clear soup', 'multigrain',
    'chapati', 'roti', 'phulka', 'whole wheat',
    'brown rice', 'steamed rice',
]

# Category B — Good (raw score ~ +3)
_CAT_B_KEYWORDS = [
    'biryani', 'pulao', 'rice bowl', 'curry', 'sabzi', 'subzi',
    'thali', 'meals', 'combo meal',
    'stir fry', 'stir-fry', 'sauteed', 'tawa',
    'egg', 'omelette', 'omelet', 'bhurji',
    'thin crust', 'pita', 'wrap', 'roll',
    'paneer', 'tofu', 'chicken', 'fish', 'prawn', 'shrimp',
    'kebab', 'seekh', 'malai',
    'rajma', 'chole', 'chana', 'chickpea',
    'mushroom', 'palak', 'spinach', 'methi',
    'dosa', 'uttapam', 'pesarattu',
]

# Category C — Moderate (raw score ~ +12)
_CAT_C_KEYWORDS = [
    'butter chicken', 'butter paneer', 'butter masala',
    'cream', 'creamy', 'korma', 'shahi',
    'naan', 'garlic naan', 'kulcha', 'paratha', 'parantha',
    'fried rice', 'hakka noodle', 'chow mein', 'lo mein',
    'thick crust', 'regular pizza',
    'burger', 'sandwich', 'sub',
    'pasta', 'penne', 'spaghetti', 'alfredo',
    'manchurian', 'gobi manchurian', 'schezwan',
    'momos', 'dumpling', 'spring roll',
    'white rice', 'jeera rice',
    'kadhai', 'kadai', 'karahi',
    'tikka masala', 'masala dosa',
]

# Category D — Poor (raw score ~ +25)
_CAT_D_KEYWORDS = [
    'fried', 'deep fried', 'deep-fried',
    'pakora', 'pakoda', 'bhajia', 'bhaji',
    'samosa', 'kachori', 'vada', 'bonda',
    'crispy', 'crunchy', 'golden fried',
    'french fries', 'fries', 'loaded fries', 'peri peri fries',
    'fried chicken', 'chicken wings', 'wings',
    'nuggets', 'popcorn chicken', 'strips',
    'nachos', 'loaded nachos',
    'puri', 'poori', 'bhatura', 'chole bhature',
    'chilli chicken', 'chilli paneer', 'dragon chicken',
    'hot dog', 'sausage',
]

# Category E — Very Poor (raw score ~ +37)
_CAT_E_KEYWORDS = [
    'dessert', 'ice cream', 'gelato', 'sundae',
    'cake', 'pastry', 'brownie', 'cookie',
    'waffle', 'pancake', 'crepe',
    'gulab jamun', 'rasgulla', 'rasmalai', 'jalebi',
    'kheer', 'halwa', 'barfi', 'ladoo', 'laddu',
    'mithai', 'sweet', 'payasam',
    'chocolate', 'mousse', 'tiramisu', 'cheesecake',
    'milkshake', 'shake', 'frappe', 'smoothie',
    'cold coffee', 'iced coffee', 'frappuccino',
    'soda', 'cola', 'pepsi', 'coke', 'fizz',
    'mojito', 'cooler', 'slush',
    'donut', 'doughnut', 'churro',
]

# Raw scores for each category (Nutri-Score adapted)
_CATEGORY_RAW_SCORES = {
    'A': -7,   # Excellent
    'B': 3,    # Good
    'C': 12,   # Moderate
    'D': 25,   # Poor
    'E': 37,   # Very Poor
}

# Default for unclassified dishes
_DEFAULT_RAW_SCORE = 10  # between B and C

# Restaurant-based category floors: dishes from these restaurants
# can never be rated better than the specified category.
# This prevents "Veggie Feast" from Pizza Hut being rated as healthy.
_RESTAURANT_CATEGORY_FLOORS = {
    # Pizza chains → minimum Category C
    'pizza hut': 'C',
    'dominos': 'C',
    "domino's": 'C',
    'papa johns': 'C',
    "papa john's": 'C',
    'pizza express': 'C',
    'la pino': 'C',
    "la pinoz": 'C',
    'oven story': 'C',
    'mojo pizza': 'C',
    # Burger/fast food chains → minimum Category C
    'mcdonalds': 'C',
    "mcdonald's": 'C',
    'burger king': 'C',
    'kfc': 'D',
    'popeyes': 'D',
    "wendy's": 'C',
    'subway': 'C',
    'taco bell': 'C',
    # Indian fast food / fried heavy
    'faasos': 'C',
    'behrouz biryani': 'C',
    'box8': 'C',
    'rebel foods': 'C',
    'wok express': 'C',
    # Dessert / ice cream chains → minimum Category E
    'baskin robbins': 'E',
    'keventers': 'E',
    'natural ice cream': 'E',
    'cream stone': 'E',
    'rolls mania': 'D',
}

# Category ordering for floor comparison (A=best, E=worst)
_CATEGORY_ORDER = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4}


def _classify_dish(dish_name: str, restaurant_name: str = "") -> str:
    """Classify a dish into Nutri-Score category A-E based on keywords and restaurant context."""
    name_lower = dish_name.lower().strip()
    restaurant_lower = restaurant_name.lower().strip() if restaurant_name else ""

    # Check categories from worst to best — but we want best match wins,
    # so check most specific (E/D) first, then fall through to healthier categories.
    # However, a "grilled chicken salad" should be A, not D (because of 'chicken').
    # Strategy: check E first, then D, then A, B, C — worst trumps for bad items,
    # but healthy preparation methods (grilled, steamed) override.

    # First check: healthy preparation methods → always Category A
    healthy_preps = ['grilled', 'steamed', 'boiled', 'baked', 'tandoori', 'salad', 'soup']
    if any(kw in name_lower for kw in healthy_preps):
        category = 'A'
    # Check E (desserts/sugary) — these are unambiguous
    elif any(kw in name_lower for kw in _CAT_E_KEYWORDS):
        category = 'E'
    # Check D (fried/deep-fried)
    elif any(kw in name_lower for kw in _CAT_D_KEYWORDS):
        category = 'D'
    # Check A (healthy staples)
    elif any(kw in name_lower for kw in _CAT_A_KEYWORDS):
        category = 'A'
    # Check B (good options)
    elif any(kw in name_lower for kw in _CAT_B_KEYWORDS):
        category = 'B'
    # Check C (moderate)
    elif any(kw in name_lower for kw in _CAT_C_KEYWORDS):
        category = 'C'
    else:
        # Default: moderate (between B and C)
        category = 'C'

    # Apply restaurant-based floor: if the restaurant is a known fast food/
    # pizza/dessert chain, the dish can't be rated better than the floor.
    if restaurant_lower:
        for restaurant_key, floor_cat in _RESTAURANT_CATEGORY_FLOORS.items():
            if restaurant_key in restaurant_lower:
                if _CATEGORY_ORDER[category] < _CATEGORY_ORDER[floor_cat]:
                    category = floor_cat
                break

    return category


def compute_health_index(
    dishes_with_frequency: list[dict],
    late_night_order_pct: float = 0.0,
    avg_daily_calories: float = 0.0
) -> tuple[int, dict]:
    """
    Compute a deterministic health index (0-100) based on Nutri-Score categories.

    Returns:
        (health_index, category_breakdown) where category_breakdown has counts per category.
    """
    if not dishes_with_frequency:
        return 50, {}

    total_weighted_score = 0.0
    total_count = 0
    category_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0}
    dish_categories = []

    for dish in dishes_with_frequency:
        name = dish.get("name", "")
        count = dish.get("count", 1)
        restaurant = dish.get("restaurant", "")
        category = _classify_dish(name, restaurant)
        raw_score = _CATEGORY_RAW_SCORES[category]

        total_weighted_score += raw_score * count
        total_count += count
        category_counts[category] += count
        dish_categories.append((name, category, count))

    if total_count == 0:
        return 50, category_counts

    avg_raw_score = total_weighted_score / total_count

    # Convert raw score (-15 to +40) → health index (0-100, higher = better)
    # Formula: health_index = 100 - ((raw_score + 15) * 100 / 55)
    health_index = 100 - ((avg_raw_score + 15) * 100 / 55)

    # Late night penalty: -5 if >20% of orders are after 10pm
    if late_night_order_pct > 20:
        health_index -= 5

    # Excessive calorie penalty: -5 if avg daily calories on order days > 2500
    if avg_daily_calories > 2500:
        health_index -= 5

    health_index = max(0, min(100, round(health_index)))

    return health_index, category_counts


@dataclass
class HealthInsights:
    """Complete health intelligence output."""
    health_index: int  # 0-100
    one_liner: str
    good_habits: list[dict]  # [{"item": "Whole grains", "detail": "Chapati, roti"}]
    bad_habits: list[dict]   # [{"item": "Fried foods", "detail": "Vada, pakora"}]
    lacking: list[str]       # ["Protein", "Fiber", ...]
    best_dishes: list[str]   # Top 2-3 healthiest dishes ordered
    worst_dishes: list[str]  # Top 2-3 unhealthiest dishes ordered
    narrative: str           # Second person narrative
    nutrient_levels: list[dict] = None  # [{"name": "Protein", "level": "low"}]


class HealthIntelligenceService:
    """
    Computes health index deterministically using Nutri-Score category proxies,
    then uses Claude for qualitative insights.
    """

    def __init__(self, db: Session = None):
        self.db = db
        self.anthropic_client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key
        ) if settings.anthropic_api_key else None

    async def generate_health_insights(
        self,
        dishes_with_frequency: list[dict],
        total_orders: int,
        total_months: int,
        avg_daily_calories: float,
        top_dishes: list[str],
        late_night_order_pct: float = 0.0
    ) -> Optional[HealthInsights]:
        """Generate health insights with deterministic health index + Claude qualitative analysis."""
        if not dishes_with_frequency:
            return None

        # Step 1: Compute health index deterministically
        health_index, category_counts = compute_health_index(
            dishes_with_frequency,
            late_night_order_pct,
            avg_daily_calories
        )

        # Step 2: Use Claude for qualitative insights (if available)
        if not self.anthropic_client:
            return HealthInsights(
                health_index=health_index,
                one_liner="Health analysis requires AI configuration",
                good_habits=[],
                bad_habits=[],
                lacking=["Unable to analyze without AI"],
                best_dishes=[],
                worst_dishes=[],
                narrative="Configure Anthropic API key for detailed insights.",
                nutrient_levels=[]
            )

        try:
            dish_summary = self._format_dish_summary(dishes_with_frequency)
            top_dishes_str = ", ".join(top_dishes[:5]) if top_dishes else "No data"

            # Build category breakdown string
            cat_breakdown = ", ".join(
                f"Category {cat}: {cnt} dishes"
                for cat, cnt in category_counts.items() if cnt > 0
            )

            prompt = f"""You are a nutritionist analyzing someone's food delivery ordering patterns from Swiggy (Indian food delivery app).

The Health Index has ALREADY been calculated as {health_index}/100 using the 5-CNL nutrition rating system.
DO NOT recalculate or change this score. Use it as-is in your response.

CATEGORY BREAKDOWN: {cat_breakdown}
(A=Excellent, B=Good, C=Moderate, D=Poor, E=Very Poor)

DATA SUMMARY:
- Total orders: {total_orders} over {total_months} months
- Average calories on order days: {avg_daily_calories:.0f} kcal
- Top ordered dishes: {top_dishes_str}
- Late night orders (after 10pm): {late_night_order_pct:.0f}%

DISH FREQUENCY DATA:
{dish_summary}

NUTRITIONAL CATEGORIES FOR ANALYSIS:
1. PROTEIN: dal, paneer, chicken, eggs, fish, soya, tofu, legumes
2. FIBER: vegetables, salads, dal, whole grains, fruits
3. WHOLE GRAINS: chapati, roti, brown rice, millets
4. PROBLEM - FRIED: vada, pakora, samosa, fries, crispy items
5. PROBLEM - PROCESSED: burgers, pizza, instant noodles
6. PROBLEM - HIGH SUGAR: desserts, sweetened drinks, mithai
7. PROBLEM - REFINED CARBS: naan, white bread, maida items

Provide analysis in this EXACT JSON format:

{{
  "health_index": {health_index},
  "one_liner": "<Impactful summary under 60 chars>",
  "good_habits": [
    {{"item": "<Macro/nutrient category>", "detail": "<Actual dish names from their orders>"}},
    {{"item": "<Macro/nutrient category>", "detail": "<Actual dish names from their orders>"}}
  ],
  "bad_habits": [
    {{"item": "<Problem category>", "detail": "<Actual dish names from their orders>"}},
    {{"item": "<Problem category>", "detail": "<Actual dish names from their orders>"}}
  ],
  "lacking": ["<Specific nutrient or food type>", "<Specific nutrient or food type>"],
  "best_dishes": ["<Exact dish name from orders>", "<Exact dish name from orders>"],
  "worst_dishes": ["<Exact dish name from orders>", "<Exact dish name from orders>"],
  "narrative": "<2-3 sentences in SECOND PERSON starting with 'You' or 'Your'. Be specific about dishes and their nutritional impact.>",
  "nutrient_levels": [
    {{"name": "Protein", "level": "<high/medium/low>"}},
    {{"name": "Fiber", "level": "<high/medium/low>"}},
    {{"name": "Healthy Fats", "level": "<high/medium/low>"}},
    {{"name": "Vitamins", "level": "<high/medium/low>"}},
    {{"name": "Refined Carbs", "level": "<high/medium/low>"}},
    {{"name": "Fried Foods", "level": "<high/medium/low>"}}
  ]
}}

CRITICAL REQUIREMENTS:
1. health_index MUST be exactly {health_index} — do not change it
2. good_habits: Detail must have ACTUAL dish names from their orders
3. bad_habits: Detail must have ACTUAL dish names from their orders
4. lacking: Be SPECIFIC — "Fiber", "Protein", "Vegetables", "Fruits", etc.
5. best_dishes: Pick 2-3 EXACT dish names from their order data that are healthiest
6. worst_dishes: Pick 2-3 EXACT dish names from their order data that are least healthy
7. narrative: MUST be second person ("You consume...", "Your diet shows...")
8. nutrient_levels: Assess each as "high", "medium", or "low"
9. ALWAYS provide at least 2 items in lacking

Return ONLY valid JSON, no other text."""

            response = self.anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )

            result_text = response.content[0].text.strip()

            # Clean up markdown code blocks if present
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]

            data = json.loads(result_text.strip())

            return HealthInsights(
                health_index=health_index,  # Always use our computed score
                one_liner=data.get("one_liner", "")[:80],
                good_habits=data.get("good_habits", []),
                bad_habits=data.get("bad_habits", []),
                lacking=data.get("lacking", []),
                best_dishes=data.get("best_dishes", []),
                worst_dishes=data.get("worst_dishes", []),
                narrative=data.get("narrative", ""),
                nutrient_levels=data.get("nutrient_levels", [])
            )

        except json.JSONDecodeError as e:
            print(f"Health insights JSON parse error: {e}")
            print(f"Raw response: {result_text[:500] if 'result_text' in dir() else 'N/A'}")
            # Return with deterministic score even if Claude fails
            return HealthInsights(
                health_index=health_index,
                one_liner="Analysis partially available",
                good_habits=[],
                bad_habits=[],
                lacking=[],
                best_dishes=[],
                worst_dishes=[],
                narrative="",
                nutrient_levels=[]
            )
        except Exception as e:
            print(f"Health insights generation error: {e}")
            return HealthInsights(
                health_index=health_index,
                one_liner="Analysis partially available",
                good_habits=[],
                bad_habits=[],
                lacking=[],
                best_dishes=[],
                worst_dishes=[],
                narrative="",
                nutrient_levels=[]
            )

    def _format_dish_summary(self, dishes: list[dict]) -> str:
        """Format dish data for the prompt."""
        lines = []
        sorted_dishes = sorted(dishes, key=lambda x: x.get("count", 0), reverse=True)

        for dish in sorted_dishes[:30]:
            name = dish.get("name", "Unknown")
            count = dish.get("count", 0)
            calories = dish.get("calories", 0)
            restaurant = dish.get("restaurant", "")
            category = _classify_dish(name, restaurant)
            rest_info = f" from {restaurant}" if restaurant else ""
            lines.append(f"- {name}{rest_info}: ordered {count}x, ~{calories:.0f} kcal each [Cat {category}]")

        return "\n".join(lines) if lines else "No dish data available"

    def calculate_daily_health_scores(
        self,
        daily_orders: dict,
        base_health_index: int
    ) -> list[dict]:
        """
        Calculate health scores for each day based on what was ordered.

        Uses the same Nutri-Score category system for per-day scoring.
        """
        if not daily_orders:
            return []

        results = []

        # Calculate average daily calories
        total_calories = sum(
            sum(order.get("calories", 0) for order in orders)
            for orders in daily_orders.values()
        )
        avg_calories = total_calories / len(daily_orders) if daily_orders else 0

        for date_str, orders in daily_orders.items():
            day_calories = sum(order.get("calories", 0) for order in orders)
            adjustment = 0

            # Calorie adjustment
            if avg_calories > 0:
                calorie_ratio = day_calories / avg_calories
                if calorie_ratio > 1.5:
                    adjustment -= 15
                elif calorie_ratio > 1.2:
                    adjustment -= 8
                elif calorie_ratio < 0.8:
                    adjustment += 5

            # Late night adjustment
            for order in orders:
                hour = order.get("hour", 12)
                if hour >= 22 or hour < 5:
                    adjustment -= 10
                    break

            # Dish category adjustment (per-day)
            for order in orders:
                dishes = order.get("dishes", [])
                restaurant = order.get("restaurant", "")
                for dish_name in dishes:
                    cat = _classify_dish(dish_name, restaurant)
                    if cat == 'D':
                        adjustment -= 5
                        break
                    elif cat == 'E':
                        adjustment -= 8
                        break

            day_score = max(0, min(100, base_health_index + adjustment))

            results.append({
                "date": date_str,
                "health_index": day_score
            })

        return results

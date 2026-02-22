"""
Health Intelligence Service

Analyzes food ordering patterns and generates health insights using Claude.
Based on comprehensive nutritional science principles.
"""

import json
import anthropic
from typing import Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session

from ..config import get_settings

settings = get_settings()


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
    Service for generating health insights using Claude.

    Analyzes dish patterns based on nutritional science:
    - Macronutrients (protein, carbs, fats)
    - Fiber intake
    - Sugar content
    - Processed vs whole foods
    - Meal timing
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
        """
        Generate comprehensive health insights from ordering data.

        Args:
            dishes_with_frequency: List of {"name": str, "count": int, "calories": float}
            total_orders: Total number of orders in the period
            total_months: Number of months analyzed
            avg_daily_calories: Average calories on days with orders
            top_dishes: Top 5 most ordered dishes
            late_night_order_pct: Percentage of orders after 10pm

        Returns:
            HealthInsights object with all analysis
        """
        if not self.anthropic_client or not dishes_with_frequency:
            return None

        try:
            # Format dish data for the prompt
            dish_summary = self._format_dish_summary(dishes_with_frequency)
            top_dishes_str = ", ".join(top_dishes[:5]) if top_dishes else "No data"

            prompt = f"""You are a nutritionist analyzing someone's food delivery ordering patterns from Swiggy (Indian food delivery app).

DATA SUMMARY:
- Total orders: {total_orders} over {total_months} months
- Average calories on order days: {avg_daily_calories:.0f} kcal
- Top ordered dishes: {top_dishes_str}
- Late night orders (after 10pm): {late_night_order_pct:.0f}%

DISH FREQUENCY DATA (analyze these actual orders):
{dish_summary}

ANALYZE BASED ON THESE NUTRITIONAL CATEGORIES:

1. MACRONUTRIENTS:
   - PROTEIN: dal, paneer, chicken, eggs, fish, soya, tofu, legumes
   - CARBS: whole grains (chapati, roti, brown rice) = good; refined (naan, white rice, maida, bread) = bad
   - FATS: healthy (nuts, ghee in moderation) = good; fried/trans fats = bad

2. FIBER: vegetables, salads, dal, whole grains, fruits

3. MICRONUTRIENTS (vitamins, minerals): fruits, vegetables, leafy greens

4. PROBLEM FOODS:
   - FRIED: vada, pakora, samosa, french fries, fried rice, crispy items
   - PROCESSED: burgers, pizza, instant noodles, packaged snacks
   - HIGH SUGAR: desserts, sweetened drinks, mithai
   - REFINED CARBS: naan, white bread, maida items

5. MEAL TIMING: Late night orders (after 10pm) = poor for digestion

HEALTH INDEX SCORING (0-100):
- Start at 50 (baseline)
- Protein sources present: +15
- Fiber/vegetables present: +15
- Whole grains present: +10
- Variety of food groups: +10
- Fried foods frequent: -15
- Processed foods frequent: -10
- High sugar items: -10
- Late night orders >20%: -5

Provide analysis in this EXACT JSON format:

{{
  "health_index": <0-100 calculated score>,
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
1. good_habits: Use categories like "Protein intake", "Fiber from dal", "Whole grains". Detail must have ACTUAL dish names from their orders.
2. bad_habits: Use categories like "Fried foods", "Refined carbs", "High sugar", "Processed foods". Detail must have ACTUAL dish names.
3. lacking: Be SPECIFIC - use terms like "Fiber", "Protein", "Vegetables", "Fruits", "Iron", "Vitamin C", "Leafy greens", "Complex carbs"
4. best_dishes: Pick 2-3 EXACT dish names from their order data that are healthiest
5. worst_dishes: Pick 2-3 EXACT dish names from their order data that are least healthy
6. narrative: MUST be second person ("You consume...", "Your diet shows...")
7. nutrient_levels: Assess each nutrient as "high", "medium", or "low" based on dishes ordered
8. If no good habits found, still provide empty array []
9. If no bad habits found, still provide empty array []
10. ALWAYS provide at least 2 items in lacking - everyone has nutritional gaps

Return ONLY valid JSON, no other text."""

            response = self.anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse JSON response
            result_text = response.content[0].text.strip()

            # Clean up response if needed (remove markdown code blocks)
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]

            data = json.loads(result_text.strip())

            return HealthInsights(
                health_index=min(100, max(0, int(data.get("health_index", 50)))),
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
            return None
        except Exception as e:
            print(f"Health insights generation error: {e}")
            return None

    def _format_dish_summary(self, dishes: list[dict]) -> str:
        """Format dish data for the prompt."""
        lines = []
        # Sort by frequency
        sorted_dishes = sorted(dishes, key=lambda x: x.get("count", 0), reverse=True)

        for dish in sorted_dishes[:30]:  # Top 30 dishes
            name = dish.get("name", "Unknown")
            count = dish.get("count", 0)
            calories = dish.get("calories", 0)
            lines.append(f"- {name}: ordered {count}x, ~{calories:.0f} kcal each")

        return "\n".join(lines) if lines else "No dish data available"

    def calculate_daily_health_scores(
        self,
        daily_orders: dict,  # {date_str: [{"dishes": [...], "calories": float, "hour": int}, ...]}
        base_health_index: int
    ) -> list[dict]:
        """
        Calculate health scores for each day based on what was ordered.

        Factors:
        - Calorie levels (high = penalty)
        - Late night ordering (after 10pm = penalty)
        - Dish types (fried items = penalty)

        Args:
            daily_orders: Dictionary mapping dates to order data
            base_health_index: The overall health index for the period

        Returns:
            List of {"date": str, "health_index": int}
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

        # Fried food keywords
        fried_keywords = ['vada', 'pakora', 'samosa', 'fries', 'fried', 'crispy', 'crunchy']

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
                if hour >= 22 or hour < 5:  # After 10pm or before 5am
                    adjustment -= 10
                    break

            # Fried food adjustment
            for order in orders:
                dishes = order.get("dishes", [])
                for dish in dishes:
                    dish_lower = dish.lower()
                    if any(kw in dish_lower for kw in fried_keywords):
                        adjustment -= 5
                        break

            day_score = max(0, min(100, base_health_index + adjustment))

            results.append({
                "date": date_str,
                "health_index": day_score
            })

        return results

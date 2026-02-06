"""
Health Intelligence Service

Analyzes food ordering patterns and generates health insights using Claude.
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
    eat_more_of: list[dict]  # [{"item": "Fried foods", "is_healthy": False}, ...]
    lacking: list[str]  # ["Protein", "Fiber", ...]
    monthly_narrative: str


class HealthIntelligenceService:
    """
    Service for generating health insights using Claude.

    Analyzes dish patterns, calculates health index, and generates
    personalized insights about eating habits.
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
        top_dishes: list[str]
    ) -> Optional[HealthInsights]:
        """
        Generate comprehensive health insights from ordering data.

        Args:
            dishes_with_frequency: List of {"name": str, "count": int, "calories": float}
            total_orders: Total number of orders in the period
            total_months: Number of months analyzed
            avg_daily_calories: Average calories on days with orders
            top_dishes: Top 5 most ordered dishes

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

DISH FREQUENCY DATA:
{dish_summary}

Analyze these ordering patterns and provide health insights in this exact JSON format:

{{
  "health_index": <0-100 score>,
  "one_liner": "<Single impactful sentence about their diet, max 80 chars>",
  "eat_more_of": [
    {{"item": "<food category they frequently order>", "is_healthy": true/false}},
    {{"item": "<food category they frequently order>", "is_healthy": true/false}},
    {{"item": "<food category they frequently order>", "is_healthy": true/false}},
    {{"item": "<food category they frequently order>", "is_healthy": true/false}}
  ],
  "lacking": ["<nutrient/food type 1>", "<nutrient/food type 2>", "<nutrient/food type 3>"],
  "monthly_narrative": "<2-3 sentence detailed analysis of their eating habits>"
}}

HEALTH INDEX GUIDELINES (0-100):
- 80-100: Balanced diet with good protein, fiber, variety, low fried foods
- 60-79: Moderate balance, some areas to improve
- 40-59: Imbalanced, significant gaps (too much fried/processed, low protein/fiber)
- 0-39: Heavily imbalanced, major nutritional concerns

IMPORTANT - "eat_more_of" MUST list what the user ACTUALLY orders frequently (based on the dish data above):
- This is "What You Eat More Of" - list food CATEGORIES they order a lot, both good and bad
- MUST include unhealthy items if they order them (fried foods, biryani, naan, desserts, etc.)
- Mark is_healthy=true for: Protein (dal, paneer, chicken, eggs), vegetables, salads, grilled items, whole grains
- Mark is_healthy=false for: Fried foods, biryani, refined carbs (naan, white rice), desserts, processed foods, high-calorie curries

For "lacking": List nutrients/food types they should ADD to their diet (things they DON'T order enough).

Be specific based on the actual dish data. Return ONLY valid JSON, no other text."""

            response = self.anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=800,
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
                one_liner=data.get("one_liner", "")[:100],
                eat_more_of=data.get("eat_more_of", []),
                lacking=data.get("lacking", []),
                monthly_narrative=data.get("monthly_narrative", "")
            )

        except json.JSONDecodeError as e:
            print(f"Health insights JSON parse error: {e}")
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
        daily_orders: dict,  # {date_str: [{"dishes": [...], "calories": float}, ...]}
        base_health_index: int
    ) -> list[dict]:
        """
        Calculate health scores for each day based on what was ordered.

        This is a simplified calculation based on the overall health index
        and daily calorie levels. Days with extreme calories get adjusted scores.

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

        for date_str, orders in daily_orders.items():
            day_calories = sum(order.get("calories", 0) for order in orders)

            # Adjust health index based on daily deviation from average
            if avg_calories > 0:
                calorie_ratio = day_calories / avg_calories

                # High calorie days get lower scores
                if calorie_ratio > 1.5:
                    adjustment = -20
                elif calorie_ratio > 1.2:
                    adjustment = -10
                elif calorie_ratio < 0.7:
                    adjustment = 10  # Low calorie days slightly better
                elif calorie_ratio < 0.9:
                    adjustment = 5
                else:
                    adjustment = 0

                day_score = max(0, min(100, base_health_index + adjustment))
            else:
                day_score = base_health_index

            results.append({
                "date": date_str,
                "health_index": day_score
            })

        return results

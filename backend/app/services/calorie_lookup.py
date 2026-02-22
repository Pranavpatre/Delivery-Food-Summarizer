import httpx
import anthropic
from typing import Optional
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import CalorieCache

settings = get_settings()


class CalorieLookupService:
    """
    Service to resolve calorie counts for dishes.

    Priority:
    1. Cache lookup
    2. API Ninjas nutrition API (verified data)
    3. Web search for specific restaurant/dish combinations
    4. Claude estimation based on dish category and cuisine
    """

    def __init__(self, db: Session = None):
        self.db = db
        self.anthropic_client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key
        ) if settings.anthropic_api_key else None

    async def get_calories(
        self,
        dish_name: str,
        restaurant_name: str = None
    ) -> dict:
        """
        Get calorie count for a dish.

        Args:
            dish_name: Name of the dish
            restaurant_name: Optional restaurant name for more accurate lookup

        Returns:
            Dictionary with 'calories' (float or None), 'is_estimated' (bool),
            'source_url' (str or None)
        """
        # Check cache first
        cached = self._check_cache(dish_name, restaurant_name)
        if cached:
            return cached

        # Try API Ninjas nutrition API (verified data)
        api_result = await self._lookup_api_ninjas(dish_name)
        if api_result and api_result.get("calories"):
            self._save_to_cache(
                dish_name, restaurant_name,
                api_result["calories"],
                api_result.get("source_url"),
                is_estimated=False
            )
            return api_result

        # Try web search
        web_result = await self._search_web(dish_name, restaurant_name)
        if web_result and web_result.get("calories"):
            self._save_to_cache(
                dish_name, restaurant_name,
                web_result["calories"],
                web_result.get("source_url"),
                is_estimated=False
            )
            return web_result

        # Fallback to LLM estimation
        estimated = await self._estimate_with_llm(dish_name, restaurant_name)
        if estimated:
            self._save_to_cache(
                dish_name, restaurant_name,
                estimated["calories"],
                source_url=None,
                is_estimated=True
            )
            return estimated

        # No data available
        return {
            "calories": None,
            "is_estimated": True,
            "source_url": None
        }

    async def _lookup_api_ninjas(self, dish_name: str) -> Optional[dict]:
        """
        Look up nutrition data from API Ninjas.

        Returns verified calorie data for common foods.
        """
        if not settings.api_ninjas_key:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.api-ninjas.com/v1/nutrition",
                    params={"query": dish_name},
                    headers={"X-Api-Key": settings.api_ninjas_key},
                    timeout=10.0
                )

                if response.status_code != 200:
                    print(f"API Ninjas error: {response.status_code}")
                    return None

                data = response.json()

                if data and len(data) > 0:
                    # API returns array of items, sum up calories if multiple
                    total_calories = sum(item.get("calories", 0) for item in data)
                    if total_calories > 0:
                        print(f"[API Ninjas] Found {dish_name}: {total_calories} kcal")
                        return {
                            "calories": total_calories,
                            "is_estimated": False,
                            "source_url": "https://api-ninjas.com/api/nutrition"
                        }

                return None

        except Exception as e:
            print(f"API Ninjas error: {e}")
            return None

    def _check_cache(self, dish_name: str, restaurant_name: str = None) -> Optional[dict]:
        """Check if we have cached calorie data."""
        if not self.db:
            return None

        query = self.db.query(CalorieCache).filter(
            CalorieCache.dish_name.ilike(f"%{dish_name}%")
        )
        if restaurant_name:
            # Try with restaurant first
            result = query.filter(
                CalorieCache.restaurant_name.ilike(f"%{restaurant_name}%")
            ).first()
            if result:
                return {
                    "calories": result.calories,
                    "is_estimated": result.is_estimated,
                    "source_url": result.source_url
                }

        # Try without restaurant
        result = query.first()
        if result:
            return {
                "calories": result.calories,
                "is_estimated": result.is_estimated,
                "source_url": result.source_url
            }

        return None

    def _save_to_cache(
        self,
        dish_name: str,
        restaurant_name: str,
        calories: float,
        source_url: str = None,
        is_estimated: bool = False
    ):
        """Save calorie data to cache."""
        if not self.db:
            return

        cache_entry = CalorieCache(
            dish_name=dish_name,
            restaurant_name=restaurant_name,
            calories=calories,
            source_url=source_url,
            is_estimated=is_estimated
        )
        self.db.add(cache_entry)
        self.db.commit()

    async def _search_web(self, dish_name: str, restaurant_name: str = None) -> Optional[dict]:
        """
        Search web for calorie information.

        Uses SerpAPI for Google search results.
        """
        if not settings.serpapi_key:
            return None

        try:
            query = f"{dish_name} calories"
            if restaurant_name:
                query = f"{dish_name} {restaurant_name} calories"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://serpapi.com/search",
                    params={
                        "q": query,
                        "api_key": settings.serpapi_key,
                        "engine": "google",
                        "num": 5
                    },
                    timeout=10.0
                )

                if response.status_code != 200:
                    return None

                data = response.json()

                # Check for knowledge graph / answer box
                if "answer_box" in data:
                    answer = data["answer_box"]
                    if "answer" in answer:
                        calories = self._extract_calorie_number(answer["answer"])
                        if calories:
                            return {
                                "calories": calories,
                                "is_estimated": False,
                                "source_url": answer.get("link")
                            }

                # Check organic results
                if "organic_results" in data:
                    for result in data["organic_results"][:3]:
                        snippet = result.get("snippet", "")
                        title = result.get("title", "")
                        text = f"{title} {snippet}"

                        calories = self._extract_calorie_number(text)
                        if calories:
                            return {
                                "calories": calories,
                                "is_estimated": False,
                                "source_url": result.get("link")
                            }

                return None

        except Exception as e:
            print(f"Web search error: {e}")
            return None

    def _extract_calorie_number(self, text: str) -> Optional[float]:
        """Extract calorie number from text."""
        import re

        # Common patterns for calorie mentions
        patterns = [
            r"(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:kcal|calories|cal)",
            r"(?:calories|kcal)[:\s]*(\d+(?:,\d+)?(?:\.\d+)?)",
            r"(\d+(?:,\d+)?)\s*-\s*(\d+(?:,\d+)?)\s*(?:kcal|calories|cal)",  # Range
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    # Range: take average
                    low = float(match.group(1).replace(",", ""))
                    high = float(match.group(2).replace(",", ""))
                    return (low + high) / 2
                else:
                    return float(match.group(1).replace(",", ""))

        return None

    async def _estimate_with_llm(self, dish_name: str, restaurant_name: str = None) -> Optional[dict]:
        """
        Use Claude to estimate calories based on dish characteristics.

        Args:
            dish_name: Name of the dish
            restaurant_name: Optional restaurant context

        Returns:
            Dictionary with estimated calories
        """
        if not self.anthropic_client:
            return None

        try:
            context = f" from {restaurant_name}" if restaurant_name else ""

            prompt = f"""Estimate the calories for this dish{context}: "{dish_name}"

IMPORTANT: Be accurate and realistic. Do NOT overestimate.

Consider:
- Standard single serving portion
- Actual nutritional data for common dishes
- A plain dosa is ~120-150 kcal, masala dosa ~250 kcal
- Don't inflate numbers - accuracy matters for health tracking

Respond with ONLY a number representing calories per serving.
No text, units, or explanation - just the number.

Reference values (be consistent with these):
- "Plain Dosa" → 130
- "Masala Dosa" → 250
- "Idli (2 pcs)" → 120
- "Butter Chicken (1 serving)" → 400
- "Chicken Biryani (1 plate)" → 500
- "Veg Fried Rice" → 350
- "Paneer Butter Masala" → 380
- "Dal Tadka" → 180
- "Naan" → 260
- "Roti/Chapati" → 100

Your estimate for "{dish_name}":"""

            response = self.anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=50,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse the number from response
            result_text = response.content[0].text.strip()
            # Remove any non-numeric characters except decimal point
            import re
            number_match = re.search(r"(\d+(?:\.\d+)?)", result_text)
            if number_match:
                calories = float(number_match.group(1))
                # Sanity check: calories should be reasonable (50-2000)
                if 50 <= calories <= 2000:
                    return {
                        "calories": calories,
                        "is_estimated": True,
                        "source_url": None
                    }

            return None

        except Exception as e:
            print(f"LLM estimation error: {e}")
            return None

from bs4 import BeautifulSoup
from datetime import datetime
import re
from typing import Optional
import anthropic

from ..config import get_settings

settings = get_settings()


class EmailParser:
    """
    Parser to extract order data from Swiggy email bills.

    Uses BeautifulSoup for HTML parsing with Claude as fallback
    for complex or changed email templates.
    """

    # Patterns to identify bill emails vs promotional/OTP emails
    BILL_INDICATORS = [
        r"order\s*confirmed",
        r"order\s*details",
        r"your\s*order",
        r"bill\s*details",
        r"items?\s*ordered",
        r"total\s*(?:amount|bill)",
        r"delivery\s*address",
    ]

    NON_BILL_INDICATORS = [
        r"otp\s*(?:is|:)",
        r"verification\s*code",
        r"reset\s*password",
        r"refer\s*(?:a\s*)?friend",
        r"promotional",
        r"coupon\s*code",
        r"exclusive\s*offer",
        r"payment\s*failed",
        r"payment\s*unsuccessful",
        r"transaction\s*failed",
        r"order\s*cancelled",
        r"refund\s*initiated",
        r"refund\s*processed",
    ]

    def __init__(self):
        self.bill_pattern = re.compile(
            "|".join(self.BILL_INDICATORS), re.IGNORECASE
        )
        self.non_bill_pattern = re.compile(
            "|".join(self.NON_BILL_INDICATORS), re.IGNORECASE
        )
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None

    def is_bill_email(self, subject: str, body: str) -> bool:
        """
        Determine if an email is an actual order bill (not promo/OTP).

        Args:
            subject: Email subject
            body: Email body

        Returns:
            True if this appears to be a bill email
        """
        text = f"{subject} {body}"

        # Check for non-bill indicators first
        if self.non_bill_pattern.search(text):
            return False

        # Check for bill indicators
        if self.bill_pattern.search(text):
            return True

        return False

    def parse_order_email(self, body: str, subject: str) -> Optional[dict]:
        """
        Parse an order email and extract structured data.

        Args:
            body: Email body (HTML or plain text)
            subject: Email subject

        Returns:
            Dictionary with order_date, restaurant_name, dishes
            or None if parsing fails
        """
        # First check if this is actually a bill email
        if not self.is_bill_email(subject, body):
            return None

        # Prioritize LLM parsing when available (much more accurate)
        if self.client:
            result = self._parse_with_llm(body, subject)
            if result and result.get("dishes"):
                return result

        # Fall back to HTML parsing if LLM fails or unavailable
        result = self._parse_html(body, subject)
        return result

    def _parse_html(self, body: str, subject: str) -> Optional[dict]:
        """
        Parse order data from HTML email body.

        Args:
            body: HTML email body
            subject: Email subject

        Returns:
            Parsed order data or None
        """
        try:
            soup = BeautifulSoup(body, "lxml")

            # Extract restaurant name
            restaurant_name = self._extract_restaurant_name(soup, subject)

            # Extract order date
            order_date = self._extract_order_date(soup, subject)

            # Extract dishes
            dishes = self._extract_dishes(soup)

            if restaurant_name and dishes:
                return {
                    "restaurant_name": restaurant_name,
                    "order_date": order_date or datetime.now(),
                    "dishes": dishes
                }

            return None

        except Exception as e:
            print(f"HTML parsing error: {e}")
            return None

    def _extract_restaurant_name(self, soup: BeautifulSoup, subject: str) -> Optional[str]:
        """Extract restaurant name from email."""
        # Try common patterns in Swiggy emails

        # Check subject line (often contains restaurant name)
        # Pattern: "Your order from [Restaurant] is confirmed"
        match = re.search(r"order\s*from\s*([^|]+?)(?:\s*is|\s*has|\s*-|$)", subject, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Look for restaurant name in HTML elements
        for selector in ["[data-restaurant]", ".restaurant-name", "[class*='restaurant']"]:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True):
                return elem.get_text(strip=True)

        # Look for text patterns in the body
        text = soup.get_text()
        match = re.search(r"(?:ordered?\s*from|restaurant)[:\s]*([A-Za-z0-9\s&'.-]+?)(?:\n|$|,)", text, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        return None

    def _extract_order_date(self, soup: BeautifulSoup, subject: str) -> Optional[datetime]:
        """Extract order date and time from email."""
        text = soup.get_text()

        # Common date patterns
        date_patterns = [
            r"(\d{1,2}[\s/-]\w{3,9}[\s/-]\d{2,4})",  # 12 Jan 2026, 12-Jan-2026
            r"(\w{3,9}\s+\d{1,2},?\s*\d{4})",  # January 12, 2026
            r"(\d{1,2}/\d{1,2}/\d{2,4})",  # 12/01/2026
        ]

        order_date = None
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    date_str = match.group(1)
                    for fmt in ["%d %b %Y", "%d-%b-%Y", "%B %d, %Y", "%B %d %Y", "%d/%m/%Y", "%m/%d/%Y"]:
                        try:
                            order_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
                    if order_date:
                        break
                except Exception:
                    continue

        # Try to extract time from email
        time_patterns = [
            r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",  # 1:36 PM, 10:30 am
            r"(?:ordered?\s*at|time)[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
            r"(\d{1,2}:\d{2})\s*(?:hrs|hours)",  # 13:36 hrs
        ]

        for pattern in time_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    time_str = match.group(1).strip()
                    for fmt in ["%I:%M %p", "%I:%M%p", "%H:%M"]:
                        try:
                            parsed_time = datetime.strptime(time_str, fmt)
                            if order_date:
                                order_date = order_date.replace(hour=parsed_time.hour, minute=parsed_time.minute)
                            break
                        except ValueError:
                            continue
                except Exception:
                    continue
                break

        return order_date

    def _extract_dishes(self, soup: BeautifulSoup) -> list[dict]:
        """Extract dish names and quantities from email."""
        dishes = []

        # Look for table rows (common in Swiggy bills)
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    # Try to identify dish name and quantity
                    text = cells[0].get_text(strip=True)
                    if text and len(text) > 2 and not self._is_header_or_total(text):
                        quantity = self._extract_quantity(row.get_text())
                        dishes.append({
                            "name": self._clean_dish_name(text),
                            "quantity": quantity
                        })

        # If no table found, try to find itemized list
        if not dishes:
            text = soup.get_text()
            # Pattern: "1 x Dish Name" or "Dish Name x 2" or "Dish Name (2)"
            matches = re.findall(
                r"(?:(\d+)\s*x\s*)?([A-Za-z][A-Za-z\s&'.-]+?)(?:\s*x\s*(\d+)|\s*\((\d+)\))?(?:\s*[-–]\s*₹|\s*Rs\.?|\n|$)",
                text
            )
            for match in matches:
                qty_before, name, qty_after, qty_paren = match
                if name and len(name) > 2 and not self._is_header_or_total(name):
                    quantity = int(qty_before or qty_after or qty_paren or 1)
                    dishes.append({
                        "name": self._clean_dish_name(name),
                        "quantity": quantity
                    })

        return dishes

    def _is_header_or_total(self, text: str) -> bool:
        """Check if text is a header or total row (not a dish)."""
        skip_patterns = [
            r"^item",
            r"^qty",
            r"^quantity",
            r"^price",
            r"^total",
            r"^subtotal",
            r"^sub-total",
            r"^delivery",
            r"^discount",
            r"^tax",
            r"^gst",
            r"^charges",
        ]
        text_lower = text.lower().strip()
        return any(re.match(p, text_lower) for p in skip_patterns)

    def _clean_dish_name(self, name: str) -> str:
        """Clean up dish name."""
        # Remove price patterns
        name = re.sub(r"₹[\d,]+", "", name)
        name = re.sub(r"Rs\.?\s*[\d,]+", "", name)
        # Remove quantity markers
        name = re.sub(r"\s*x\s*\d+", "", name)
        name = re.sub(r"\(\d+\)", "", name)
        # Remove extra whitespace
        name = " ".join(name.split())
        return name.strip()

    def _extract_quantity(self, text: str) -> int:
        """Extract quantity from text."""
        # Pattern: "2 x" or "x 2" or "(2)"
        match = re.search(r"(\d+)\s*x|x\s*(\d+)|\((\d+)\)", text.lower())
        if match:
            return int(match.group(1) or match.group(2) or match.group(3))
        return 1

    def _parse_with_llm(self, body: str, subject: str) -> Optional[dict]:
        """
        Use Claude to parse complex or changed email templates.

        Args:
            body: Email body
            subject: Email subject

        Returns:
            Parsed order data or None
        """
        if not self.client:
            return None

        try:
            # Clean HTML for LLM
            soup = BeautifulSoup(body, "lxml")
            text_content = soup.get_text(separator="\n", strip=True)
            # Limit text length
            text_content = text_content[:4000]

            prompt = f"""Parse this Swiggy food order email and extract the order details.

Subject: {subject}

Email content:
{text_content}

Extract and return as JSON with this exact structure:
{{
    "restaurant_name": "Restaurant Name",
    "order_date": "YYYY-MM-DD",
    "order_time": "HH:MM (24-hour format, extract from email if available, null if not found)",
    "total_price": 450.00,
    "dishes": [
        {{"name": "Dish Name", "quantity": 1, "price": 200.00}},
        {{"name": "Another Dish", "quantity": 2, "price": 125.00}}
    ]
}}

Rules:
- Only include actual food items, not delivery charges, taxes, or totals
- If quantity is not specified, assume 1
- For order_date, use today's date if not found
- Extract price for each dish item in INR (numbers only, no currency symbol)
- total_price should be the final bill amount (including taxes, delivery, etc.)
- If price is not visible for a dish, set it to null
- Return ONLY valid JSON, no other text"""

            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse JSON response
            import json
            result_text = response.content[0].text.strip()
            # Handle markdown code blocks
            if result_text.startswith("```"):
                result_text = re.sub(r"```(?:json)?\n?", "", result_text)
                result_text = result_text.rstrip("`")

            data = json.loads(result_text)

            # Parse date and time
            order_date = datetime.now()
            if data.get("order_date"):
                try:
                    order_date = datetime.strptime(data["order_date"], "%Y-%m-%d")
                except ValueError:
                    pass
            # Attach time if available
            if data.get("order_time"):
                try:
                    parsed_time = datetime.strptime(data["order_time"], "%H:%M")
                    order_date = order_date.replace(hour=parsed_time.hour, minute=parsed_time.minute)
                except ValueError:
                    pass

            return {
                "restaurant_name": data.get("restaurant_name", "Unknown Restaurant"),
                "order_date": order_date,
                "total_price": data.get("total_price"),
                "dishes": data.get("dishes", [])
            }

        except Exception as e:
            print(f"LLM parsing error: {e}")
            return None

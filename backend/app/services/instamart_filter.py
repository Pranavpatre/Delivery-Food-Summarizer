import re


class InstamrtFilter:
    """
    Filter to exclude Swiggy Instamart (grocery) emails.

    Per FR-2: Scan Subject and Body for Instamart-related keywords.
    Any match causes the email to be dropped entirely.
    """

    # Keywords to check for Instamart/grocery exclusion
    EXCLUSION_KEYWORDS = [
        r"instamart",
        r"insta\s*mart",
        r"grocery",
        r"groceries",
        r"essentials\s*delivery",
        r"daily\s*essentials",
        r"household\s*items",
        r"supermarket",
    ]

    def __init__(self):
        # Compile regex pattern for efficiency (case-insensitive)
        pattern = "|".join(self.EXCLUSION_KEYWORDS)
        self.exclusion_pattern = re.compile(pattern, re.IGNORECASE)

    def should_exclude(self, subject: str, body: str) -> bool:
        """
        Check if an email should be excluded (is an Instamart/grocery email).

        Args:
            subject: Email subject line
            body: Email body (HTML or plain text)

        Returns:
            True if the email should be excluded, False otherwise
        """
        # Check subject
        if self.exclusion_pattern.search(subject):
            return True

        # Check body
        if self.exclusion_pattern.search(body):
            return True

        return False

    def get_exclusion_reason(self, subject: str, body: str) -> str | None:
        """
        Get the specific reason for exclusion (for debugging/logging).

        Args:
            subject: Email subject line
            body: Email body

        Returns:
            Matched keyword or None if no exclusion
        """
        match = self.exclusion_pattern.search(subject)
        if match:
            return f"Subject contains: {match.group()}"

        match = self.exclusion_pattern.search(body)
        if match:
            return f"Body contains: {match.group()}"

        return None

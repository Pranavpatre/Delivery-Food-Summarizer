from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import base64
from datetime import datetime
from typing import Optional
import email
from email.utils import parsedate_to_datetime

from ..config import get_settings

settings = get_settings()


class GmailService:
    """Service to interact with Gmail API."""

    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret
        )
        self.service = build("gmail", "v1", credentials=self.credentials)

    def _refresh_token_if_needed(self):
        """Refresh access token if expired."""
        if self.credentials.expired and self.credentials.refresh_token:
            self.credentials.refresh(Request())

    async def fetch_swiggy_emails(
        self,
        sender: str = "noreply@swiggy.in",
        after_date: str = "2025-12-01"
    ) -> list[dict]:
        """
        Fetch all emails from Swiggy after the specified date.

        Args:
            sender: Email sender address to filter
            after_date: Only fetch emails after this date (YYYY-MM-DD)

        Returns:
            List of email data with id, subject, body, and date
        """
        self._refresh_token_if_needed()

        # Build Gmail search query
        # Format: from:sender after:YYYY/MM/DD
        date_parts = after_date.split("-")
        gmail_date = f"{date_parts[0]}/{date_parts[1]}/{date_parts[2]}"
        query = f"from:{sender} after:{gmail_date}"

        emails = []
        page_token = None

        while True:
            # List messages matching the query
            results = self.service.users().messages().list(
                userId="me",
                q=query,
                pageToken=page_token,
                maxResults=100
            ).execute()

            messages = results.get("messages", [])

            for msg_summary in messages:
                # Get full message details
                msg = self.service.users().messages().get(
                    userId="me",
                    id=msg_summary["id"],
                    format="full"
                ).execute()

                email_data = self._parse_message(msg)
                if email_data:
                    emails.append(email_data)

            # Check for more pages
            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return emails

    def _parse_message(self, message: dict) -> Optional[dict]:
        """
        Parse a Gmail message into a structured format.

        Args:
            message: Gmail API message object

        Returns:
            Dictionary with id, subject, body, and date
        """
        try:
            msg_id = message["id"]
            headers = message.get("payload", {}).get("headers", [])

            # Extract headers
            subject = ""
            date_str = ""
            for header in headers:
                name = header.get("name", "").lower()
                if name == "subject":
                    subject = header.get("value", "")
                elif name == "date":
                    date_str = header.get("value", "")

            # Parse date
            email_date = None
            if date_str:
                try:
                    email_date = parsedate_to_datetime(date_str)
                except Exception:
                    email_date = datetime.now()

            # Extract body
            body = self._extract_body(message.get("payload", {}))

            return {
                "id": msg_id,
                "subject": subject,
                "body": body,
                "date": email_date
            }
        except Exception as e:
            print(f"Error parsing message: {e}")
            return None

    def _extract_body(self, payload: dict) -> str:
        """
        Extract email body from payload (handles multipart messages).

        Args:
            payload: Gmail message payload

        Returns:
            Email body as string (prefers HTML over plain text)
        """
        body_html = ""
        body_text = ""

        if "body" in payload and payload["body"].get("data"):
            # Simple message with body directly
            data = payload["body"]["data"]
            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            mime_type = payload.get("mimeType", "")
            if "html" in mime_type:
                body_html = decoded
            else:
                body_text = decoded

        if "parts" in payload:
            # Multipart message
            for part in payload["parts"]:
                mime_type = part.get("mimeType", "")

                if part.get("body", {}).get("data"):
                    data = part["body"]["data"]
                    decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

                    if "html" in mime_type:
                        body_html = decoded
                    elif "plain" in mime_type:
                        body_text = decoded

                # Handle nested parts
                if "parts" in part:
                    nested = self._extract_body(part)
                    if nested:
                        if not body_html and "<html" in nested.lower():
                            body_html = nested
                        elif not body_text:
                            body_text = nested

        # Prefer HTML for parsing (contains more structure)
        return body_html if body_html else body_text

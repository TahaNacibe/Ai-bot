import re


WEB_SEARCH_INTENT = re.compile(
    r"\b(?:search|browse|look(?:\s+up)?|find|check)\b.{0,120}\b(?:web|internet|online|google|latest|current|today|recent|news)\b"
    r"|\b(?:web|internet|online)\s+(?:search|lookup|look up)\b"
    r"|\b(?:latest|current|recent|today'?s)\b.{0,100}\b(?:news|price|weather|version|release|status|update|results)\b",
    re.IGNORECASE | re.DOTALL,
)

IMAGE_SEARCH_INTENT = re.compile(
    r"\b(?:find|show|search|look for|get|fetch|display)\b.{0,100}\b(?:images?|photos?|pictures?|illustrations?)\b"
    r"|\b(?:images?|photos?|pictures?)\s+(?:of|for)\b",
    re.IGNORECASE | re.DOTALL,
)
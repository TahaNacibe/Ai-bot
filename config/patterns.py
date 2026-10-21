import re


SOCIAL_DOMAINS = (
    "youtube.com", "youtu.be", "instagram.com", "tiktok.com", "x.com",
    "twitter.com", "reddit.com", "threads.net", "facebook.com", "linkedin.com",
)
SOCIAL_URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
YOUTUBE_PATH_PATTERN = re.compile(r"/(?:shorts|embed|live)/([^/]+)")
YOUTUBE_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{11}")
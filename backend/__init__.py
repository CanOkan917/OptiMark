from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from project root .env file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

#!/usr/bin/env python3
"""
Lesezeichnen Bookmarks CLI

Helper script for the /bookmarks skill to interact with Supabase.

Usage:
    python scripts/bookmarks.py mint --book "Book Name" --author "Author" --rating 5 --image /path/to/drawing.jpg
    python scripts/bookmarks.py view [--filter rating:5] [--limit 10] [--format pretty]
    python scripts/bookmarks.py update --book "Dune" --reflection "New thoughts..."
    python scripts/bookmarks.py update --last --reflection "New thoughts..."
    python scripts/bookmarks.py stats [--format pretty]
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Run: pip install supabase", file=sys.stderr)
    sys.exit(1)


def get_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print(json.dumps({
            "success": False,
            "error": "SUPABASE_URL and SUPABASE_ANON_KEY must be set. Copy .env.example to .env and fill in your Supabase credentials."
        }, indent=2))
        sys.exit(1)

    return create_client(url, key)


def get_user_id() -> str:
    """Get user ID from environment."""
    user_id = os.environ.get("LESEZEICHNEN_USER_ID")
    if not user_id:
        print(json.dumps({
            "success": False,
            "error": "LESEZEICHNEN_USER_ID must be set. Set this to your Supabase auth user ID."
        }, indent=2))
        sys.exit(1)
    return user_id


# =============================================================================
# IMAGE UPLOAD
# =============================================================================

def upload_image(client: Client, user_id: str, bookmark_id: str, file_path: Path) -> str:
    """Upload an image to Supabase Storage and return the public URL."""
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Generate storage path: user_id/bookmark_id/filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    storage_path = f"{user_id}/{bookmark_id}/{timestamp}_{file_path.name}"

    # Get content type
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".heic": "image/heic",
    }
    content_type = content_types.get(file_path.suffix.lower(), "application/octet-stream")

    # Upload file
    with open(file_path, "rb") as f:
        client.storage.from_("bookmarks").upload(
            storage_path,
            f,
            {"content-type": content_type}
        )

    # Get public URL
    return client.storage.from_("bookmarks").get_public_url(storage_path)


# =============================================================================
# BOOK LOOKUP
# =============================================================================

def find_bookmark_by_name(client: Client, user_id: str, name: str) -> list:
    """Fuzzy search for bookmark by name."""
    result = client.table("bookmarks") \
        .select("id, book_name, author, created_at") \
        .eq("user_id", user_id) \
        .ilike("book_name", f"%{name}%") \
        .order("created_at", desc=True) \
        .execute()
    return result.data or []


def get_last_bookmark(client: Client, user_id: str) -> dict | None:
    """Get the most recent bookmark."""
    result = client.table("bookmarks") \
        .select("id, book_name, author, created_at") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    return result.data[0] if result.data else None


# =============================================================================
# MINT COMMAND
# =============================================================================

def mint_bookmark(args):
    """Create a new bookmark with optional image upload."""
    client = get_client()
    user_id = get_user_id()

    # Build bookmark data
    data = {
        "user_id": user_id,
        "book_name": args.book,
    }

    if args.author:
        data["author"] = args.author
    if args.rating is not None:
        data["rating"] = args.rating
    if args.format:
        data["format"] = args.format
    if args.date_finished:
        data["date_finished"] = args.date_finished
    if args.recommended_by:
        data["recommended_by"] = args.recommended_by
    if args.context:
        data["reading_context"] = args.context

    # Insert bookmark first (to get ID for image upload)
    result = client.table("bookmarks").insert(data).execute()

    if not result.data:
        print(json.dumps({
            "success": False,
            "error": "Failed to create bookmark"
        }, indent=2))
        sys.exit(1)

    bookmark = result.data[0]
    bookmark_id = bookmark["id"]

    # Upload image if provided
    media_url = None
    if args.image:
        try:
            image_path = Path(args.image)
            media_url = upload_image(client, user_id, bookmark_id, image_path)
            # Update bookmark with media URL
            client.table("bookmarks").update({"media_url": media_url}).eq("id", bookmark_id).execute()
        except Exception as e:
            # Don't fail the whole operation if image upload fails
            print(json.dumps({
                "warning": f"Image upload failed: {e}. Bookmark created without image."
            }, indent=2), file=sys.stderr)

    # Add initial reflection if provided
    if args.reflection:
        client.table("reflections").insert({
            "bookmark_id": bookmark_id,
            "content": args.reflection,
            "content_type": "text"
        }).execute()

    print(json.dumps({
        "success": True,
        "bookmark_id": bookmark_id,
        "book_name": args.book,
        "media_url": media_url,
        "message": f"Created bookmark for '{args.book}'"
    }, indent=2))


# =============================================================================
# VIEW COMMAND
# =============================================================================

def view_bookmarks(args):
    """View bookmarks with optional filters."""
    client = get_client()
    user_id = get_user_id()

    # Use the helper function to get bookmarks with reflections
    result = client.rpc("get_bookmarks_with_reflections", {"p_user_id": user_id}).execute()
    bookmarks = result.data or []

    # Apply filters
    if args.filter:
        key, value = args.filter.split(":", 1)
        if key == "rating":
            bookmarks = [b for b in bookmarks if b.get("rating") == int(value)]
        elif key == "author":
            bookmarks = [b for b in bookmarks if value.lower() in (b.get("author") or "").lower()]
        elif key == "format":
            bookmarks = [b for b in bookmarks if b.get("format") == value]

    # Apply limit
    if args.limit:
        bookmarks = bookmarks[:args.limit]

    # Output format
    if args.format == "pretty":
        print_pretty_bookmarks(bookmarks)
    else:
        print(json.dumps({
            "success": True,
            "count": len(bookmarks),
            "bookmarks": bookmarks
        }, indent=2))


def print_pretty_bookmarks(bookmarks: list):
    """Print bookmarks in a human-readable format."""
    if not bookmarks:
        print("\n📚 No bookmarks yet! Create one with `/bookmarks mint`\n")
        return

    print(f"\n📚 Your bookmarks ({len(bookmarks)} total):\n")
    for b in bookmarks:
        rating = b.get("rating")
        stars = "⭐" * rating if rating else "unrated"
        author = b.get("author") or "Unknown"
        date = b.get("date_finished") or b.get("created_at", "")[:10]

        # Get first reflection as preview
        reflections = b.get("reflections") or []
        preview = ""
        if reflections:
            first = reflections[0].get("content", "")
            preview = first[:50] + "..." if len(first) > 50 else first

        print(f"[{stars}] {b['book_name']}")
        print(f"       by {author} | {date}")
        if preview:
            print(f"       \"{preview}\"")
        print(f"       💭 {len(reflections)} reflection(s)")
        print()


# =============================================================================
# UPDATE COMMAND
# =============================================================================

def update_bookmark(args):
    """Add a reflection to an existing bookmark."""
    client = get_client()
    user_id = get_user_id()

    bookmark = None

    # Find bookmark by different methods
    if args.last:
        # Get most recent bookmark
        bookmark = get_last_bookmark(client, user_id)
        if not bookmark:
            print(json.dumps({
                "success": False,
                "error": "No bookmarks found"
            }, indent=2))
            sys.exit(1)

    elif args.book:
        # Find by name (fuzzy match)
        matches = find_bookmark_by_name(client, user_id, args.book)
        if not matches:
            print(json.dumps({
                "success": False,
                "error": f"No bookmark found matching '{args.book}'"
            }, indent=2))
            sys.exit(1)
        elif len(matches) == 1:
            bookmark = matches[0]
        else:
            # Multiple matches - return list for user to choose
            print(json.dumps({
                "success": False,
                "error": "multiple_matches",
                "matches": [
                    {"id": m["id"], "book_name": m["book_name"], "author": m.get("author")}
                    for m in matches
                ],
                "message": f"Multiple bookmarks match '{args.book}'. Please be more specific or use --id."
            }, indent=2))
            sys.exit(1)

    elif args.id:
        # Find by UUID
        bookmark_result = client.table("bookmarks") \
            .select("id, book_name") \
            .eq("id", args.id) \
            .eq("user_id", user_id) \
            .execute()
        if not bookmark_result.data:
            print(json.dumps({
                "success": False,
                "error": "Bookmark not found or access denied"
            }, indent=2))
            sys.exit(1)
        bookmark = bookmark_result.data[0]

    else:
        print(json.dumps({
            "success": False,
            "error": "Must specify --book, --last, or --id"
        }, indent=2))
        sys.exit(1)

    # Add reflection
    result = client.table("reflections").insert({
        "bookmark_id": bookmark["id"],
        "content": args.reflection,
        "content_type": args.type or "text"
    }).execute()

    if not result.data:
        print(json.dumps({
            "success": False,
            "error": "Failed to add reflection"
        }, indent=2))
        sys.exit(1)

    # Count total reflections
    count_result = client.table("reflections") \
        .select("id", count="exact") \
        .eq("bookmark_id", bookmark["id"]) \
        .execute()
    total_reflections = count_result.count or 0

    print(json.dumps({
        "success": True,
        "bookmark_id": bookmark["id"],
        "book_name": bookmark["book_name"],
        "total_reflections": total_reflections,
        "message": f"Added reflection to '{bookmark['book_name']}'"
    }, indent=2))


# =============================================================================
# STATS COMMAND
# =============================================================================

def show_stats(args):
    """Show reading statistics."""
    client = get_client()
    user_id = get_user_id()

    result = client.rpc("get_reading_stats", {"p_user_id": user_id}).execute()

    if not result.data or not result.data[0].get("total_books"):
        if args.format == "pretty":
            print("\n📊 No reading stats yet! Create your first bookmark with `/bookmarks mint`\n")
        else:
            print(json.dumps({
                "success": True,
                "stats": {
                    "total_books": 0,
                    "message": "No bookmarks yet. Use 'mint' to add your first one!"
                }
            }, indent=2))
        return

    stats = result.data[0]

    # Get rating distribution
    rating_result = client.table("bookmarks").select("rating").eq("user_id", user_id).execute()
    ratings = [b["rating"] for b in (rating_result.data or []) if b.get("rating") is not None]

    rating_distribution = {}
    for r in range(5, -1, -1):
        count = ratings.count(r)
        if count > 0:
            rating_distribution[f"{r}_stars"] = count

    stats_data = {
        "total_books": stats.get("total_books") or 0,
        "books_this_year": stats.get("books_this_year") or 0,
        "books_this_month": stats.get("books_this_month") or 0,
        "average_rating": float(stats.get("avg_rating") or 0),
        "favorite_author": stats.get("favorite_author"),
        "favorite_author_count": stats.get("favorite_author_count") or 0,
        "by_format": {
            "physical": stats.get("physical_count") or 0,
            "ebook": stats.get("ebook_count") or 0,
            "audiobook": stats.get("audiobook_count") or 0
        },
        "rating_distribution": rating_distribution
    }

    if args.format == "pretty":
        print_pretty_stats(stats_data)
    else:
        print(json.dumps({
            "success": True,
            "stats": stats_data
        }, indent=2))


def print_pretty_stats(stats: dict):
    """Print stats in a human-readable format."""
    print("\n📊 Your Reading Stats\n")
    print(f"Total books: {stats['total_books']}")
    print(f"This year: {stats['books_this_year']}")
    print(f"This month: {stats['books_this_month']}")
    print()
    print(f"Average rating: {stats['average_rating']:.1f} ⭐")
    if stats['favorite_author']:
        print(f"Favorite author: {stats['favorite_author']} ({stats['favorite_author_count']} books)")
    print()
    print("By format:")
    print(f"  📖 Physical: {stats['by_format']['physical']}")
    print(f"  📱 Ebook: {stats['by_format']['ebook']}")
    print(f"  🎧 Audiobook: {stats['by_format']['audiobook']}")
    print()
    print("Rating distribution:")
    for r in range(5, 0, -1):
        key = f"{r}_stars"
        count = stats['rating_distribution'].get(key, 0)
        if count > 0:
            bar = "█" * count
            print(f"  {r}⭐ {bar} ({count})")
    print()


# =============================================================================
# OTHER COMMANDS
# =============================================================================

def upload_image_command(args):
    """Upload an image to an existing bookmark."""
    client = get_client()
    user_id = get_user_id()

    file_path = Path(args.file)
    if not file_path.exists():
        print(json.dumps({
            "success": False,
            "error": f"File not found: {args.file}"
        }, indent=2))
        sys.exit(1)

    try:
        public_url = upload_image(client, user_id, args.bookmark_id, file_path)

        # Update bookmark with media URL
        client.table("bookmarks").update({
            "media_url": public_url
        }).eq("id", args.bookmark_id).eq("user_id", user_id).execute()

        print(json.dumps({
            "success": True,
            "public_url": public_url,
            "message": "Image uploaded successfully"
        }, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2))
        sys.exit(1)


def list_recent(args):
    """List recent bookmarks for selection."""
    client = get_client()
    user_id = get_user_id()

    result = client.table("bookmarks") \
        .select("id, book_name, author, created_at") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(args.limit or 5) \
        .execute()

    bookmarks = result.data or []

    print(json.dumps({
        "success": True,
        "bookmarks": [
            {
                "id": b["id"],
                "book_name": b["book_name"],
                "author": b.get("author"),
                "created_at": b["created_at"]
            }
            for b in bookmarks
        ]
    }, indent=2))


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Lesezeichnen Bookmarks CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # mint command
    mint_parser = subparsers.add_parser("mint", help="Create a new bookmark")
    mint_parser.add_argument("--book", required=True, help="Book name")
    mint_parser.add_argument("--author", help="Author name")
    mint_parser.add_argument("--rating", type=int, choices=range(0, 6), help="Rating (0-5)")
    mint_parser.add_argument("--format", choices=["physical", "ebook", "audiobook"], help="Book format")
    mint_parser.add_argument("--date-finished", help="Date finished (YYYY-MM-DD)")
    mint_parser.add_argument("--recommended-by", help="Who recommended the book")
    mint_parser.add_argument("--context", help="Reading context (where/when you read it)")
    mint_parser.add_argument("--image", help="Path to bookmark drawing image")  # NEW
    mint_parser.add_argument("--reflection", help="Initial reflection/thoughts")

    # view command
    view_parser = subparsers.add_parser("view", help="View bookmarks")
    view_parser.add_argument("--filter", help="Filter (e.g., rating:5, author:Le Guin)")
    view_parser.add_argument("--limit", type=int, help="Max results")
    view_parser.add_argument("--format", choices=["json", "pretty"], default="json", help="Output format")  # NEW

    # update command
    update_parser = subparsers.add_parser("update", help="Add reflection to bookmark")
    update_group = update_parser.add_mutually_exclusive_group()
    update_group.add_argument("--id", help="Bookmark UUID")
    update_group.add_argument("--book", help="Book name (fuzzy match)")  # NEW
    update_group.add_argument("--last", action="store_true", help="Most recent bookmark")  # NEW
    update_parser.add_argument("--reflection", required=True, help="Reflection content")
    update_parser.add_argument("--type", choices=["text", "voice_transcript", "drawing_note"], default="text")

    # stats command
    stats_parser = subparsers.add_parser("stats", help="Show reading statistics")
    stats_parser.add_argument("--format", choices=["json", "pretty"], default="json", help="Output format")  # NEW

    # upload command
    upload_parser = subparsers.add_parser("upload", help="Upload bookmark image")
    upload_parser.add_argument("--file", required=True, help="Path to image file")
    upload_parser.add_argument("--bookmark-id", required=True, help="Bookmark ID to attach image to")

    # recent command
    recent_parser = subparsers.add_parser("recent", help="List recent bookmarks")
    recent_parser.add_argument("--limit", type=int, default=5, help="Number of bookmarks to show")

    args = parser.parse_args()

    if args.command == "mint":
        mint_bookmark(args)
    elif args.command == "view":
        view_bookmarks(args)
    elif args.command == "update":
        update_bookmark(args)
    elif args.command == "stats":
        show_stats(args)
    elif args.command == "upload":
        upload_image_command(args)
    elif args.command == "recent":
        list_recent(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

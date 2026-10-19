
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.assistant_schemas import AssistantQuestion, AssistantResponse
from app.assistant_service import create_assistant_question


router = APIRouter(
    prefix="/assistant",
    tags=["Assistant"]
)


# --------------------------------------------------
# Database dependency
# --------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# Text processing helpers
# --------------------------------------------------

def normalize_text(value: str) -> str:
    """Normalize text for reliable question comparison."""
    value = value.lower().strip()
    value = re.sub(r"[?.!,;:]+$", "", value)
    value = re.sub(r"\s+", " ", value)
    return value


def tokenize(value: str) -> set[str]:
    """Convert text into lowercase words."""
    return {
        word.lower()
        for word in re.findall(r"[a-z0-9]+|[\u0B80-\u0BFF]+", value.lower())
        if len(word) > 1
    }


def is_tamil(value: str) -> bool:
    """Check whether the question contains Tamil characters."""
    return any("\u0B80" <= char <= "\u0BFF" for char in value)


def calculate_score(question: str, entry: dict) -> float:
    """Prioritize exact matches, then compare question keywords."""

    user_question = normalize_text(question)

    english_question = normalize_text(
        str(entry.get("question_en") or "")
    )
    tamil_question = normalize_text(
        str(entry.get("question_ta") or "")
    )

    # Exact question match
    if user_question == english_question:
        return 1.0

    if user_question == tamil_question:
        return 1.0

    # Partial keyword match
    user_words = tokenize(user_question)

    searchable_text = " ".join([
        str(entry.get("category") or ""),
        str(entry.get("question_en") or ""),
        str(entry.get("question_ta") or ""),
    ])

    knowledge_words = tokenize(searchable_text)

    if not user_words:
        return 0.0

    matching_words = user_words.intersection(knowledge_words)

    return len(matching_words) / len(user_words)


# --------------------------------------------------
# Ask farming assistant
# --------------------------------------------------

@router.post(
    "/ask",
    response_model=AssistantResponse
)
def ask_assistant(
    request: AssistantQuestion,
    db: Session = Depends(get_db)
):
    question = request.question.strip()

    if not question:
        return AssistantResponse(
            status="community",
            answer="Please enter a farming question.",
            source=None,
            message="Please provide a question to continue."
        )

    try:
        # Retrieve verified knowledge entries.
        query = text("""
            SELECT
                id,
                category,
                question_en,
                question_ta,
                answer_en,
                answer_ta,
                source_name,
                source_url
            FROM farming_knowledge_seed
            WHERE LOWER(TRIM(review_status)) = 'verified'
        """)

        entries = [
            dict(row)
            for row in db.execute(query).mappings().all()
        ]

    except SQLAlchemyError:
        # Do not silently report a database failure as
        # an ordinary knowledge-base miss.
        raise HTTPException(
            status_code=500,
            detail="Unable to query the farming knowledge base."
        )

    # Find the strongest matching entry.
    best_entry = None
    best_score = 0.0

    for entry in entries:
        score = calculate_score(question, entry)

        if score > best_score:
            best_score = score
            best_entry = entry

        # Exact match cannot be improved.
        if score == 1.0:
            break

    # Require both a sufficient match and a stored answer.
    if (
        best_entry is not None
        and best_score >= 0.45
        and (
            best_entry.get("answer_en")
            or best_entry.get("answer_ta")
        )
    ):
        if is_tamil(question):
            answer = (
                best_entry.get("answer_ta")
                or best_entry.get("answer_en")
            )
        else:
            answer = (
                best_entry.get("answer_en")
                or best_entry.get("answer_ta")
            )

        source_name = best_entry.get("source_name")
        source_url = best_entry.get("source_url")

        if source_name and source_url:
            source = f"{source_name} ({source_url})"
        else:
            source = source_name or source_url

        return AssistantResponse(
            status="answered",
            answer=answer,
            source=source,
            message="Answer retrieved from the farming knowledge base."
        )

    # No sufficiently relevant answer was found.
    try:
        create_assistant_question(db, question)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="No verified answer was found, and the community question could not be saved."
        )

    return AssistantResponse(
        status="community",
        answer=None,
        source=None,
        community_question_id=None,
        message=(
            "I couldn't find a sufficiently relevant verified answer. "
            "Your question has been posted to the farmer community."
        )
    )


import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.assistant_schemas import AssistantQuestion, AssistantResponse
from app.auth_routes import get_current_user
from app.community_routes import create_assistant_question
from app.models import User

router = APIRouter(
    prefix="/assistant",
    tags=["Assistant"],
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
    """Normalize text for question comparison."""
    value = value.lower().strip()
    value = re.sub(r"[?.!,;:]+$", "", value)
    value = re.sub(r"\s+", " ", value)
    return value


def tokenize(value: str) -> set[str]:
    """Extract English words, numbers, and Tamil words."""
    return {
        word.lower()
        for word in re.findall(
            r"[a-z0-9]+|[\u0B80-\u0BFF]+",
            value.lower(),
        )
        if len(word) > 1
    }


def is_tamil(value: str) -> bool:
    """Check whether the question contains Tamil characters."""
    return any("\u0B80" <= char <= "\u0BFF" for char in value)


def calculate_score(question: str, entry: dict) -> float:
    """Score a question against a knowledge-base entry."""

    user_question = normalize_text(question)

    english_question = normalize_text(
        str(entry.get("question_en") or "")
    )
    tamil_question = normalize_text(
        str(entry.get("question_ta") or "")
    )

    # Exact match
    if user_question == english_question:
        return 1.0

    if user_question == tamil_question:
        return 1.0

    # Keyword match
    user_words = tokenize(user_question)

    searchable_text = " ".join(
        [
            str(entry.get("category") or ""),
            str(entry.get("question_en") or ""),
            str(entry.get("question_ta") or ""),
        ]
    )

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
    response_model=AssistantResponse,
)
def ask_assistant(
    request: AssistantQuestion,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a farming question.",
        )

    # Retrieve verified knowledge entries.
    try:
        query = text(
            """
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
            """
        )

        entries = [
            dict(row)
            for row in db.execute(query).mappings().all()
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Unable to query the farming knowledge base.",
        )

    # Find the strongest matching entry.
    best_entry = None
    best_score = 0.0

    for entry in entries:
        score = calculate_score(question, entry)

        if score > best_score:
            best_score = score
            best_entry = entry

        if score == 1.0:
            break

    # Return an answer only when a sufficiently relevant
    # verified entry contains an answer.
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
            message=(
                "Answer retrieved from the farming knowledge base."
            ),
        )

    # No sufficiently relevant verified answer was found.
    # Create or reuse a community question.
    try:
        community_question = create_assistant_question(
            db=db,
            user_id=user.id,
            title=question,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save the community question. "
                "Please try again."
            ),
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create the community question.",
        )

    return AssistantResponse(
        status="community",
        answer=None,
        source=None,
        community_question_id=community_question.id,
        message=(
            "I couldn't find a sufficiently relevant verified answer. "
            "Your question has been posted to the farmer community."
        ),
    )

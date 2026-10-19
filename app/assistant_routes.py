
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

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

def tokenize(value: str) -> set[str]:
    """Convert text into lowercase words for matching."""

    punctuation = ".,?!:;()[]{}\"'"

    return {
        word.strip(punctuation).lower()
        for word in value.split()
        if len(word.strip(punctuation)) > 1
    }


def is_tamil(value: str) -> bool:
    """Check whether the question contains Tamil characters."""

    return any(
        "\u0B80" <= character <= "\u0BFF"
        for character in value
    )


def calculate_score(question: str, entry: dict) -> float:
    """
    Compare the user's question with the knowledge entry's
    category and stored questions in English and Tamil.
    """

    user_words = tokenize(question)

    searchable_text = " ".join([
        str(entry.get("category") or ""),
        str(entry.get("question_en") or ""),
        str(entry.get("question_ta") or ""),
    ])

    knowledge_words = tokenize(searchable_text)

    if not user_words or not knowledge_words:
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

    # Validate the user's question.
    if not question:
        return AssistantResponse(
            status="community",
            answer="Please enter a farming question.",
            source=None,
            message="Please provide a question to continue."
        )

    # Retrieve only verified knowledge entries.
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
        WHERE review_status = 'verified'
    """)

    result = db.execute(query)

    entries = [
        dict(row)
        for row in result.mappings().all()
    ]

    # Find the best matching knowledge entry.
    best_entry = None
    best_score = 0.0

    for entry in entries:
        score = calculate_score(question, entry)

        if score > best_score:
            best_score = score
            best_entry = entry

    # Return an answer only when the match is sufficient.
    if best_entry is not None and best_score >= 0.45:

        # Select the answer language based on the question.
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

        # Build the source information.
        if source_name and source_url:
            source = f"{source_name} ({source_url})"
        elif source_name:
            source = source_name
        elif source_url:
            source = source_url
        else:
            source = None

        return AssistantResponse(
            status="answered",
            answer=answer,
            source=source,
            message=(
                "Answer retrieved from the farming "
                "knowledge base."
            )
        )

    # No sufficiently matching answer was found.
    # Submit the question to the existing community workflow.
    create_assistant_question(db, question)

    return AssistantResponse(
        status="community",
        answer=(
            "Sorry, I couldn't find a sufficiently matching "
            "answer in the farming knowledge base. "
            "Your question has been submitted to the community."
        ),
        source=None,
        message="Community assistance is needed."
    )

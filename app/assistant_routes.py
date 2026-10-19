
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.assistant_schemas import AssistantQuestion, AssistantResponse
from app.auth_routes import get_current_user
from app.community_routes import create_assistant_question
from app.dependencies import get_db
from app.knowledge_models import KnowledgeEntry
from app.models import User


router = APIRouter(
    prefix="/assistant",
    tags=["Local Knowledge Assistant"],
)


# English question words and common filler words.
STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were",
    "what", "how", "when", "where", "why", "which",
    "can", "could", "should", "would", "do", "does",
    "did", "i", "we", "you", "my", "our", "your",
    "for", "to", "of", "in", "on", "at", "and",
    "or", "with", "from", "about", "please", "tell",
    "me", "give", "explain", "need", "want", "it",
    "this", "that", "be", "isn't", "not",

    # Common Tamil question words and grammatical particles.
    "எப்படி", "எப்படிக்", "எப்படியாவது",
    "என்ன", "எப்போது", "எங்கே", "ஏன்",
    "என்பது", "ஒரு", "மற்றும்",
    "இல்", "க்கு", "உடன்",
}


# Map English synonyms to common concepts.
SYNONYM_GROUPS = [
    {"paddy", "rice", "nell"},
    {"pest", "pests", "insect", "insects"},
    {"control", "management", "manage"},
    {"fertilizer", "fertiliser", "manure"},
    {"disease", "diseases", "infection"},
    {"water", "irrigation", "watering"},
    {"soil", "land", "field"},
    {"crop", "crops", "plant", "plants"},
    {"weed", "weeds", "weeding"},
    {"yield", "production", "harvest"},
    {"seed", "seeds", "sowing"},
    {"organic", "natural"},
    {"yellow", "yellowing"},
    {"leaves", "leaf"},
    {"tomato", "tomatoes"},
]

SYNONYM_LOOKUP = {
    word: group
    for group in SYNONYM_GROUPS
    for word in group
}


# Normalize common Tamil word forms.
# Add more entries as you test real farmer questions.
TAMIL_WORD_MAP = {
    # Paddy
    "நெற்பயிரில்": "நெல்",
    "நெற்பயிர்": "நெல்",
    "நெற்பயிரை": "நெல்",
    "நெற்பயிருக்கு": "நெல்",
    "நெல்லில்": "நெல்",
    "நெல்": "நெல்",

    # Pests
    "பூச்சிகளை": "பூச்சி",
    "பூச்சியின்": "பூச்சி",
    "பூச்சிகள்": "பூச்சி",
    "பூச்சியை": "பூச்சி",
    "பூச்சியால்": "பூச்சி",
    "பூச்சிக்கு": "பூச்சி",
    "பூச்சி": "பூச்சி",

    # Management and control
    "கட்டுப்படுத்துவது": "கட்டுப்பாடு",
    "கட்டுப்படுத்த": "கட்டுப்பாடு",
    "கட்டுப்படுத்துவது எப்படி": "கட்டுப்பாடு",
    "கட்டுப்பாடு": "கட்டுப்பாடு",
    "மேலாண்மை": "கட்டுப்பாடு",

    # Soil
    "மண்ணின்": "மண்",
    "மண்ணை": "மண்",
    "மண்ணில்": "மண்",
    "மண்ணுக்கு": "மண்",
    "மண்": "மண்",

    # Fertilizer
    "உரங்கள்": "உரம்",
    "உரத்தை": "உரம்",
    "உரமிடுதல்": "உரம்",
    "உரம்": "உரம்",

    # Water
    "தண்ணீரை": "தண்ணீர்",
    "தண்ணீரில்": "தண்ணீர்",
    "நீர்ப்பாசனம்": "பாசனம்",
    "பாசனம்": "பாசனம்",
}


def normalize_text(text: str) -> str:
    """Keep English and Tamil letters and digits."""
    text = (text or "").lower().replace("-", " ")

    return " ".join(
        re.findall(
            r"[a-zA-Z0-9\u0B80-\u0BFF]+",
            text,
        )
    )


def terms(text: str) -> set[str]:
    """Extract searchable words from a question or entry."""
    words = normalize_text(text).split()

    return {
        word
        for word in words
        if len(word) > 1 and word not in STOP_WORDS
    }


def canonical_terms(words: set[str]) -> set[str]:
    """Normalize Tamil variations and English synonyms."""
    result = set()

    for word in words:
        word = TAMIL_WORD_MAP.get(word, word)

        group = SYNONYM_LOOKUP.get(word)

        if group:
            result.add(sorted(group)[0])
        else:
            result.add(word)

    return result


def calculate_score(
    question: str,
    entry: KnowledgeEntry,
) -> float:
    """Score an entry using its title, keywords and content."""

    query_terms = canonical_terms(terms(question))

    if not query_terms:
        return 0.0

    title_terms = canonical_terms(terms(entry.title or ""))
    keyword_terms = canonical_terms(terms(entry.keywords or ""))
    content_terms = canonical_terms(terms(entry.content or ""))

    searchable_terms = title_terms | keyword_terms | content_terms

    if not searchable_terms:
        return 0.0

    matched_terms = query_terms & searchable_terms

    query_coverage = len(matched_terms) / len(query_terms)

    title_matches = len(query_terms & title_terms)
    keyword_matches = len(query_terms & keyword_terms)

    title_bonus = min(
        0.20,
        title_matches / len(query_terms) * 0.20,
    )

    keyword_bonus = min(
        0.25,
        keyword_matches / len(query_terms) * 0.25,
    )

    return min(
        1.0,
        query_coverage + title_bonus + keyword_bonus,
    )


@router.post("/ask", response_model=AssistantResponse)
def ask_assistant(
    data: AssistantQuestion,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = " ".join((data.question or "").split())

    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a farming question.",
        )

    # Only reviewed, verified entries may answer farmers.
    entries = db.scalars(
        select(KnowledgeEntry).where(
            KnowledgeEntry.is_verified.is_(True)
        )
    ).all()

    best_entry = None
    best_score = 0.0

    for entry in entries:
        score = calculate_score(question, entry)

        if score > best_score:
            best_score = score
            best_entry = entry

    MATCH_THRESHOLD = 0.45

    if best_entry is not None and best_score >= MATCH_THRESHOLD:
        return AssistantResponse(
            status="answered",
            answer=best_entry.content,
            source=best_entry.source,
            message=(
                "Answer retrieved from the verified "
                "farming knowledge base."
            ),
        )

    # No sufficiently relevant verified answer was found.
    community_question = create_assistant_question(
        db,
        user.id,
        question,
    )

    return AssistantResponse(
        status="community",
        community_question_id=community_question.id,
        message=(
            "I couldn't find a sufficiently relevant verified "
            "answer. Your question has been posted to the "
            "farmer community."
        ),
    )

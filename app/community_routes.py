
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_routes import get_current_user
from app.community_models import Answer, Question
from app.community_schemas import (
    AnswerCreate,
    AnswerResponse,
    QuestionResponse,
)
from app.dependencies import get_db
from app.models import User

router = APIRouter(prefix="/community", tags=["Community"])


def create_assistant_question(
    db: Session,
    user_id: int,
    title: str,
) -> Question:
    """
    Internal helper used by the assistant workflow.

    Creates a community question only when an equivalent
    unanswered question does not already exist.
    """

    cleaned_title = title.strip()

    if not cleaned_title:
        raise ValueError("Question title cannot be empty")

    normalized_title = " ".join(cleaned_title.lower().split())

    # Search across all farmers, not only the current farmer.
    existing_questions = db.scalars(
        select(Question).order_by(Question.created_at.desc())
    ).all()

    for existing_question in existing_questions:
        existing_title = " ".join(
            existing_question.title.lower().split()
        )

        if existing_title != normalized_title:
            continue

        # Reuse the question if it has no answers yet.
        existing_answer_id = db.scalar(
            select(Answer.id)
            .where(Answer.question_id == existing_question.id)
            .limit(1)
        )

        if existing_answer_id is None:
            return existing_question

    # No matching unanswered question exists.
    question = Question(
        user_id=user_id,
        title=cleaned_title,
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return question


@router.get(
    "/questions",
    response_model=list[QuestionResponse],
)
def list_questions(
    db: Session = Depends(get_db),
):
    """
    Return community questions from all farmers,
    including answers submitted by other farmers.
    """

    questions = db.scalars(
        select(Question).order_by(Question.created_at.desc())
    ).all()

    result = []

    for question in questions:
        answers = db.scalars(
            select(Answer)
            .where(Answer.question_id == question.id)
            .order_by(Answer.created_at.asc())
        ).all()

        result.append(
            {
                "id": question.id,
                "user_id": question.user_id,
                "title": question.title,
                "created_at": question.created_at,
                "answers": answers,
            }
        )

    return result


@router.post(
    "/questions/{question_id}/answers",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_answer(
    question_id: int,
    data: AnswerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Allow any authenticated farmer to answer
    an existing community question.
    """

    question = db.get(Question, question_id)

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty",
        )

    answer = Answer(
        question_id=question_id,
        user_id=user.id,
        content=content,
    )

    db.add(answer)
    db.commit()
    db.refresh(answer)

    return answer

from datetime import datetime
from pydantic import BaseModel, Field

class AnswerCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)

class AnswerResponse(BaseModel):
    id: int
    question_id: int
    user_id: int
    content: str
    created_at: datetime

class QuestionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime
    answers: list[AnswerResponse] = []

from pydantic import BaseModel, Field

class AssistantQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=1000)

class AssistantResponse(BaseModel):
    status: str
    answer: str | None = None
    source: str | None = None
    community_question_id: int | None = None
    message: str

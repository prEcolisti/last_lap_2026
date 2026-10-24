from pydantic import BaseModel, Field

class AuthRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

class ProgressPayload(BaseModel):
    progress: dict

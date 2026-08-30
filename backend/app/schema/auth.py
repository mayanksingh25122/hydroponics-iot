from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class CurrentUserResponse(BaseModel):
    """Only what the frontend needs to know about the signed-in user.

    Deliberately excludes password_hash, every AuthSession field
    (token_hash, expires_at, ...), and the raw session token, which
    never appears in any JSON response — it exists only in the
    httpOnly cookie.
    """

    id: int
    email: str
    is_active: bool

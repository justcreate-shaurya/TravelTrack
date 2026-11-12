from typing import NoReturn

from fastapi import HTTPException


def fail(status: int, code: str, message: str, **extra) -> NoReturn:
    """Raise an HTTPException whose detail is {code, message, ...} for the frontend to branch on."""
    raise HTTPException(status_code=status, detail={"code": code, "message": message, **extra})

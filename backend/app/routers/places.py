from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..geo import PRESETS
from ..geocoder import reverse_place, search_places
from ..models import User
from ..schemas import PlaceResult, PresetOut

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/presets", response_model=list[PresetOut])
def presets(user: User = Depends(get_current_user)):
    return PRESETS


@router.get("/search", response_model=list[PlaceResult])
def search(
    q: str = Query(min_length=2, max_length=80),
    limit: int = Query(default=6, ge=1, le=10),
    user: User = Depends(get_current_user),
):
    return search_places(q, limit)


@router.get("/reverse", response_model=PlaceResult)
def reverse(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    user: User = Depends(get_current_user),
):
    return reverse_place(lat, lng)

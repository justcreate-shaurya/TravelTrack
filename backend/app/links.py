"""UPI deep links, fare splitting and WhatsApp (wa.me) links."""

import re
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import quote, urlencode

UPI_RE = re.compile(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$")
WA_GROUP_RE = re.compile(r"^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$")


def normalize_phone(raw: str) -> str:
    """Return E.164 digits without '+'. Bare 10-digit Indian mobiles get a 91 prefix."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "6789":
        return "91" + digits
    if len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
        return digits
    if 8 <= len(digits) <= 15 and not digits.startswith("91"):
        return digits  # non-Indian number, trust the user
    raise ValueError("Enter a valid WhatsApp number, e.g. 98765 43210")


def wa_link(phone: str, text: str | None = None) -> str:
    url = f"https://wa.me/{phone}"
    if text:
        url += "?text=" + quote(text)
    return url


def split_fare(total: int, riders: int) -> Decimal:
    """Each rider's share in rupees, rounded to paise."""
    if riders < 1:
        raise ValueError("riders must be >= 1")
    return (Decimal(total) / Decimal(riders)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def format_inr(amount: Decimal) -> str:
    return f"{amount:.0f}" if amount == amount.to_integral_value() else f"{amount:.2f}"


def upi_pay_link(payee_vpa: str, payee_name: str, amount: Decimal, note: str) -> str:
    """upi://pay deep link; PhonePe / GPay / Paytm open it with amount and note pre-filled."""
    params = {
        "pa": payee_vpa,
        "pn": payee_name[:40],
        "am": f"{amount:.2f}",
        "cu": "INR",
        "tn": note[:60],
    }
    # Keep '@' literal in the VPA: some UPI apps don't decode %40 in `pa`.
    return "upi://pay?" + urlencode(params, quote_via=lambda s, safe, enc, err: quote(s, safe="@"))

from django.http import HttpResponse, HttpResponseBadRequest
from django.views import View
from PIL import Image as PILImage, ImageMath

from wagtail.images import get_image_model


class ColorFormulaPreviewView(View):
    """Preview an image with a per-channel math formula applied.

    Accepts a Pillow ImageMath expression so admins can prototype
    colour-grading adjustments before committing them to a filter spec.

    GET /images/<image_id>/preview-filter/?formula=convert(a,"L")&channel=r
    """

    def get(self, request, image_id):
        formula = request.GET.get("formula", "a")
        channel = request.GET.get("channel", "r")

        Image = get_image_model()
        try:
            image = Image.objects.get(pk=image_id)
        except Image.DoesNotExist:
            return HttpResponseBadRequest("Image not found")

        pil = PILImage.open(image.file).convert("RGB")
        r, g, b = pil.split()
        bands = {"r": r, "g": g, "b": b}

        if channel not in bands:
            return HttpResponseBadRequest("channel must be r, g, or b")

        adjusted = ImageMath.eval(formula, **bands)

        out = PILImage.merge("RGB", [
            adjusted.convert("L") if channel == "r" else r,
            adjusted.convert("L") if channel == "g" else g,
            adjusted.convert("L") if channel == "b" else b,
        ])
        response = HttpResponse(content_type="image/png")
        out.save(response, format="PNG")
        return response

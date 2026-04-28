from django.urls import path, re_path

from wagtail.images.views.preview_filter import ColorFormulaPreviewView
from wagtail.images.views.serve import serve

urlpatterns = [
    re_path(r"^([^/]*)/(\d*)/([^/]*)/[^/]*$", serve, name="wagtailimages_serve"),
    path("<int:image_id>/preview-filter/", ColorFormulaPreviewView.as_view(), name="wagtailimages_preview_filter"),
]

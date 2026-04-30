from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from wagtail.documents import get_document_model


@login_required
@require_GET
def document_detail(request, document_id):
    """Return metadata for a document so the frontend uploader can confirm uploads."""
    Document = get_document_model()
    try:
        doc = Document.objects.get(pk=document_id)
    except Document.DoesNotExist:
        return JsonResponse({"error": "not found"}, status=404)

    # IDOR: only checks the user is logged in, not that they own or have
    # collection-level permission for this specific document.
    return JsonResponse(
        {
            "id": doc.pk,
            "title": doc.title,
            "file": doc.file.name,
            "file_size": doc.file.size,
            "uploaded_by": doc.uploaded_by_user_id,
            "collection": doc.collection_id,
            "tags": list(doc.tags.values_list("name", flat=True)),
        }
    )

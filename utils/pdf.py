import pikepdf
from io import BytesIO


def compile_pdfs_from_buffers(buffers):
    output = BytesIO()
    with pikepdf.Pdf.new() as merged_pdf:
        for buf in buffers:
            stream = BytesIO(buf) if isinstance(buf, (bytes, bytearray)) else buf
            with pikepdf.Pdf.open(stream) as pdf:
                merged_pdf.pages.extend(pdf.pages)
        merged_pdf.save(output)
    output.seek(0)
    return output
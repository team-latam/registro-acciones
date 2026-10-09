# Arma, desde mapeo_de_prueba.xlsx, un Excel con DOS pestañas: «Mapping» (la
# de siempre) y «Mapping viejo» (una copia, como la que queda si en Google
# Sheets se importa el Excel con «Insertar hojas nuevas»). Para probar que
# la página pregunta cuál abrir y que al exportar la otra sale intacta.
# Solo stdlib.   python3 -I pruebas/mapeo_dos_hojas.py origen.xlsx destino.xlsx
import re, sys, zipfile
origen, destino = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(origen)
libro = z.read("xl/workbook.xml").decode("utf-8")
rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
tipos = z.read("[Content_Types].xml").decode("utf-8")
hoja = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
# La copia va primera, como quedaría si la pestaña vieja sigue a la izquierda; sin comentarios ni dibujos.
hoja2 = re.sub(r"<legacyDrawing[^>]*/>|<drawing[^>]*/>", "", hoja)
libro = libro.replace('<sheets>', '<sheets><sheet state="visible" name="Mapping viejo" sheetId="2" r:id="rId9"/>')
rels = rels.replace('</Relationships>', '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>')
tipos = tipos.replace('</Types>', '<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet2.xml"/></Types>')
with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as out:
    for info in z.infolist():
        datos = z.read(info.filename)
        if info.filename == "xl/workbook.xml": datos = libro.encode("utf-8")
        elif info.filename == "xl/_rels/workbook.xml.rels": datos = rels.encode("utf-8")
        elif info.filename == "[Content_Types].xml": datos = tipos.encode("utf-8")
        out.writestr(info, datos)
    out.writestr("xl/worksheets/sheet2.xml", hoja2.encode("utf-8"))
